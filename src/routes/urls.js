const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const validUrl = require('valid-url');
const rateLimit = require('express-rate-limit');
const Url = require('../models/Url');
const { protect, optionalAuth } = require('../middleware/auth');
const DistributedStorage = require('../storage');

const storage = new DistributedStorage();

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Max 20 URLs per minute.' }
});

//POST/api/urls/shorten
router.post('/shorten', createLimiter, optionalAuth, async (req, res) => {
  try {
    const { url, customCode } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required.' });
    if (!validUrl.isWebUri(url)) return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });

//Custom code path
    if (customCode) {
      const cleaned = customCode.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
      if (!cleaned || cleaned.length < 3) {
        return res.status(400).json({ error: 'Custom code must be at least 3 characters.' });
      }
      const existing = await Url.findOne({ shortCode: cleaned });
      if (existing) {
        return res.status(409).json({ error: `"${cleaned}" is already taken. Try another.` });
      }
    const { primaryNode, replicaNode } =
  await storage.set(cleaned, {
    originalUrl: url,
    shortCode: cleaned
  });
      await Url.create({ shortCode: cleaned, originalUrl: url, user: req.user ? req.user._id : null, primaryNode, replicaNode });
      // const shortUrl = `http://localhost:${process.env.PORT || 3000}/${cleaned}`;
      const shortUrl = `${process.env.BASE_URL}/${cleaned}`;
      return res.status(201).json({ success: true, shortUrl, shortCode: cleaned, originalUrl: url, primaryNode, replicaNode, isOwned: !!req.user });
    }

    // Auto-generate with retry (handles duplicate collisions)
    let attempts = 0;
    while (attempts < 5) {
      const shortCode = nanoid(7);
      const existing = await Url.findOne({ shortCode });
      if (existing) { attempts++; continue; }

      try {
        const { primaryNode, replicaNode } =
  await storage.set(shortCode, {
    originalUrl: url,
    shortCode
  });
        await Url.create({ shortCode, originalUrl: url, user: req.user ? req.user._id : null, primaryNode, replicaNode });
        // const shortUrl = `http://localhost:${process.env.PORT || 3000}/${shortCode}`;
        const shortUrl = `${process.env.BASE_URL}/${shortCode}`;
        return res.status(201).json({ success: true, shortUrl, shortCode, originalUrl: url, primaryNode, replicaNode, isOwned: !!req.user });
      } catch (dupErr) {
        if (dupErr.code === 11000) { attempts++; continue; }
        throw dupErr;
      }
    }

    return res.status(500).json({ error: 'Could not generate unique code. Please try again.' });

  } catch (err) {
    console.error('Shorten error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/urls/my
router.get('/my', protect, async (req, res) => {
  try {
    const urls = await Url.find({ user: req.user._id }).sort({ createdAt: -1 }).select('-clickHistory');
    return res.json({ success: true, count: urls.length, urls });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/urls/:code
router.delete('/:code', protect, async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.code });
    if (!urlDoc) return res.status(404).json({ error: 'URL not found.' });
    if (!urlDoc.user || urlDoc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own URLs.' });
    }
    await Url.deleteOne({ shortCode: req.params.code });
    return res.json({ success: true, message: 'URL deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/urls/stats/:code
router.get('/stats/:code', protect, async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.code, user: req.user._id });
    if (!urlDoc) return res.status(404).json({ error: 'URL not found or not yours.' });
    return res.json({ success: true, url: urlDoc });
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = { router, storage };
