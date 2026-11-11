const fs = require('fs/promises');
const path = require('path');
const Property = require('../models/Property');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { ROOT } = require('../middleware/upload');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Deletes uploaded files (given as /uploads/... URLs), ignoring missing ones. */
const removeFiles = async (urls = []) => {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const rel = url.replace(/^\/uploads\//, '');
        const full = path.join(ROOT, rel);
        if (full.startsWith(ROOT)) await fs.unlink(full);
      } catch (_) {
        /* file already gone */
      }
    })
  );
};

/** Validates and normalises the body of create/update requests. */
const parseFields = (body) => {
  const errors = [];
  const out = {};

  const str = (key, label) => {
    if (!body[key] || !String(body[key]).trim()) errors.push(`${label} is required`);
    else out[key] = String(body[key]).trim();
  };
  const num = (key, label) => {
    const v = Number(body[key]);
    if (body[key] === undefined || body[key] === '' || Number.isNaN(v) || v < 0) {
      errors.push(`${label} must be a non-negative number`);
    } else out[key] = v;
  };

  str('title', 'Title');
  str('location', 'Location');
  str('description', 'Description');
  num('price', 'Price');
  num('bedrooms', 'Bedrooms');
  num('bathrooms', 'Bathrooms');
  num('area', 'Area');

  return { errors, out };
};

// GET /api/properties?minPrice&maxPrice&location&bedrooms&search&page&limit
exports.getProperties = async (req, res, next) => {
  try {
    const { minPrice, maxPrice, location, bedrooms, search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 48);

    const filter = {};
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (location) filter.location = new RegExp(escapeRegex(location), 'i');
    if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) };
    if (search) filter.title = new RegExp(escapeRegex(search), 'i');

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate('agent', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Property.countDocuments(filter),
    ]);

    res.json({ properties, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/mine  (agent)
exports.getMyProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({ agent: req.user._id }).sort({ createdAt: -1 });
    res.json({ properties });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id
exports.getProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate('agent', 'name email phone');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    res.json({ property });
  } catch (err) {
    next(err);
  }
};

// POST /api/properties  (agent, multipart: images[])
exports.createProperty = async (req, res, next) => {
  const uploaded = (req.files || []).map((f) => `/uploads/properties/${f.filename}`);
  try {
    const { errors, out } = parseFields(req.body);
    if (errors.length) {
      await removeFiles(uploaded);
      return res.status(400).json({ message: errors.join(', ') });
    }
    const property = await Property.create({ ...out, images: uploaded, agent: req.user._id });
    res.status(201).json({ property });
  } catch (err) {
    await removeFiles(uploaded);
    next(err);
  }
};

// PUT /api/properties/:id  (owner agent; body.existingImages = JSON array to keep)
exports.updateProperty = async (req, res, next) => {
  const uploaded = (req.files || []).map((f) => `/uploads/properties/${f.filename}`);
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      await removeFiles(uploaded);
      return res.status(404).json({ message: 'Property not found' });
    }
    if (property.agent.toString() !== req.user._id.toString()) {
      await removeFiles(uploaded);
      return res.status(403).json({ message: 'You can only edit your own listings' });
    }

    const { errors, out } = parseFields(req.body);
    if (errors.length) {
      await removeFiles(uploaded);
      return res.status(400).json({ message: errors.join(', ') });
    }

    // Keep only images that already belong to this listing
    let keep = property.images;
    if (req.body.existingImages !== undefined) {
      try {
        const requested = JSON.parse(req.body.existingImages);
        keep = property.images.filter((img) => requested.includes(img));
      } catch (_) {
        await removeFiles(uploaded);
        return res.status(400).json({ message: 'existingImages must be a JSON array' });
      }
    }
    const removed = property.images.filter((img) => !keep.includes(img));

    Object.assign(property, out, { images: [...keep, ...uploaded] });
    await property.save();
    await removeFiles(removed);

    res.json({ property });
  } catch (err) {
    await removeFiles(uploaded);
    next(err);
  }
};

// DELETE /api/properties/:id  (owner agent)
exports.deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.agent.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own listings' });
    }

    // Remove related conversations + messages
    const convos = await Conversation.find({ property: property._id }).select('_id');
    const ids = convos.map((c) => c._id);
    await Message.deleteMany({ conversation: { $in: ids } });
    await Conversation.deleteMany({ _id: { $in: ids } });

    await removeFiles(property.images);
    await property.deleteOne();
    res.json({ message: 'Property deleted' });
  } catch (err) {
    next(err);
  }
};
