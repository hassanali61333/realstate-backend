const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Property = require('../models/Property');

const POPULATE = [
  { path: 'property', select: 'title price location images' },
  { path: 'buyer', select: 'name email' },
  { path: 'agent', select: 'name email' },
];

// buyer/agent may be populated documents or raw ObjectIds, so read _id when present
const idOf = (ref) => (ref && ref._id ? ref._id : ref).toString();

const isParticipant = (convo, userId) =>
  idOf(convo.buyer) === userId.toString() || idOf(convo.agent) === userId.toString();


exports.getOrCreateConversation = async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({ message: 'A valid propertyId is required' });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    let convo = await Conversation.findOne({ property: property._id, buyer: req.user._id });
    if (!convo) {
      convo = await Conversation.create({
        property: property._id,
        buyer: req.user._id,
        agent: property.agent,
      });
    }

    convo = await convo.populate(POPULATE);
    res.status(200).json({ conversation: convo });
  } catch (err) {
    next(err);
  }
};

exports.getConversations = async (req, res, next) => {
  try {
    const field = req.user.role === 'agent' ? 'agent' : 'buyer';
    const conversations = await Conversation.find({ [field]: req.user._id })
      .populate(POPULATE)
      .sort({ updatedAt: -1 });
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const convo = await Conversation.findById(req.params.id).populate(POPULATE);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    if (!isParticipant(convo, req.user._id)) {
      return res.status(403).json({ message: 'Not your conversation' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const filter = { conversation: convo._id };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ conversation: convo, messages: messages.reverse(), hasMore: messages.length === limit });
  } catch (err) {
    next(err);
  }
};

exports.uploadChatImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  res.status(201).json({ url: `/uploads/chat/${req.file.filename}` });
};


exports.getUnreadCount = async (req, res, next) => {
  try {
    const isAgent = req.user.role === 'agent';
    const convos = await Conversation.find({ [isAgent ? 'agent' : 'buyer']: req.user._id }).select(
      'unreadAgent unreadBuyer'
    );
    const total = convos.reduce((sum, c) => sum + (isAgent ? c.unreadAgent : c.unreadBuyer), 0);
    res.json({ total });
  } catch (err) {
    next(err);
  }
};