const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true },
    bedrooms: { type: Number, required: true, min: 0 },
    bathrooms: { type: Number, required: true, min: 0 },
    area: { type: Number, required: true, min: 0 }, // square feet
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    images: [{ type: String }], // e.g. /uploads/properties/abc.jpg
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

propertySchema.index({ price: 1, bedrooms: 1 });
propertySchema.index({ location: 'text', title: 'text' });

module.exports = mongoose.model('Property', propertySchema);
