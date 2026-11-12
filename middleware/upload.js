const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Vercel ka filesystem read-only hai, sirf /tmp writable hai
const ROOT = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', 'uploads');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn('Could not create upload dir:', dir, err.message);
  }
};

const makeUpload = (folder, maxFiles) => {
  const dest = path.join(ROOT, folder);
  ensureDir(dest);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // /tmp cold start par khali ho sakta hai, is liye upload ke waqt bhi banayein
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: maxFiles }, // 5MB each
  });
};

const propertyUpload = makeUpload('properties', 8);
const chatUpload = makeUpload('chat', 1);

module.exports = { propertyUpload, chatUpload, ROOT };