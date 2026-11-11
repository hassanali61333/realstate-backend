const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    image: { type: String, default: '' }, // e.g. /uploads/chat/abc.jpg
    read: { type: Boolean, default: false }, // read receipt (double tick)
  },
  { timestamps: true }
);

// A message must contain text or an image
messageSchema.pre('validate', function (next) {
  if (!this.text && !this.image) {
    return next(new Error('Message must contain text or an image'));
  }
  next();
});

messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
