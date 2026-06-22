const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  clicks: { type: Number, default: 0 },
  clickHistory: [{
    timestamp: { type: Date, default: Date.now },
    ip: String,
    userAgent: String
  }],
  primaryNode: { type: String, default: 'node-1' },
  replicaNode: { type: String, default: 'node-2' },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: null }
});

urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Url', urlSchema);
