require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const Url = require('./models/Url');
const authRoutes = require('./routes/auth');
const { router: urlRoutes, storage } = require('./routes/urls');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

app.get('/api/stats', async (req, res) => {
  try {
    const totalUrls = await Url.countDocuments();
   const storageStats = await storage.getStats();
    return res.json({ storage: { ...storageStats, totalUrls }, recentRequests: [] });
  } catch(e) {
    return res.json({ storage: { totalUrls: 0, cacheSize: 0, cacheHitRate: '0%', nodeDistribution: { 'node-1': 0, 'node-2': 0, 'node-3': 0 } }, recentRequests: [] });
  }
});

const redirectLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.get('/:code([a-zA-Z0-9]{3,12})', redirectLimiter, async (req, res) => {
  try {
    const urlDoc = await Url.findOne({ shortCode: req.params.code, isActive: true });
    if (!urlDoc) return res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
    urlDoc.clicks += 1;
    urlDoc.lastAccessed = new Date();
    urlDoc.clickHistory.push({ ip: req.ip, userAgent: req.get('User-Agent') });
    await urlDoc.save();
    return res.redirect(301, urlDoc.originalUrl);
  } catch (err) {
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb://127.0.0.1:27017/snaplink';

mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`\n🚀 SnapLink running on http://localhost:${PORT}\n`));
  })
  // .catch(err => {
  //   console.error('❌ MongoDB failed:', err.message);
  //   console.log('👉 Run in terminal: net start MongoDB\n');
  //   app.listen(PORT, () => console.log(`SnapLink running on http://localhost:${PORT} (no DB)`));
  // });
   .catch(err => {
    console.error(
      'MongoDB connection failed:',
      err.message
    );
  });

module.exports = app;
