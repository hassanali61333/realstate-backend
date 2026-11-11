const mongoose = require('mongoose');


const conversationSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: {
      text: { type: String, default: '' },
      image: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date },
    },
    unreadAgent: { type: Number, default: 0 },
    unreadBuyer: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One thread per buyer per property
conversationSchema.index({ property: 1, buyer: 1 }, { unique: true });
conversationSchema.index({ buyer: 1, updatedAt: -1 });
conversationSchema.index({ agent: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
