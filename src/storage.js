// /**
//  * Distributed Storage — now backed by MongoDB
//  *
//  * Architecture:
//  * - MongoDB is the persistent source of truth
//  * - Consistent hashing still determines which "shard" owns a key (for demo)
//  * - LRU cache sits in front of MongoDB for fast reads
//  */

// const mongoose = require('mongoose');
// const ConsistentHashRing = require('./consistentHashing');
// const Url = require('./models/Url');

// const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/snaplink';

// class DistributedStorage {
//   constructor() {
//     this.ring = new ConsistentHashRing(150);
//     ['node-1', 'node-2', 'node-3'].forEach(n => this.ring.addNode(n));

//     // LRU cache (in-memory, in front of MongoDB)
//     this.cache = new Map();
//     this.cacheMaxSize = 1000;
//     this.cacheHits = 0;
//     this.cacheMisses = 0;

//     // Connect to MongoDB
//     this._connect();
//   }

//   async _connect() {
//     try {
//       await mongoose.connect(MONGO_URI);
//       console.log('  MongoDB connected:', MONGO_URI);
//     } catch (err) {
//       console.error('  MongoDB connection error:', err.message);
//       console.error('  Make sure MongoDB is running: mongod');
//     }
//   }

//   /**
//    * Store a URL in MongoDB + cache
//    */
//   async set(shortCode, data) {
//     const primaryNode = this.ring.getNode(shortCode);
//     const nodes = this.ring.getNodes(shortCode, 2);
//     const replicaNode = nodes[1] || primaryNode;

//     const doc = await Url.create({
//       shortCode,
//       originalUrl: data.originalUrl,
//       node: primaryNode,
//     });

//     this._cacheSet(shortCode, {
//       ...doc.toObject(),
//       fromCache: false,
//     });

//     return { primaryNode, replicaNode };
//   }

//   /**
//    * Get a URL — check cache first, then MongoDB
//    */
//   async get(shortCode) {
//     // 1. LRU cache
//     const cached = this._cacheGet(shortCode);
//     if (cached) {
//       this.cacheHits++;
//       return { ...cached, fromCache: true };
//     }

//     this.cacheMisses++;

//     // 2. MongoDB
//     const doc = await Url.findOne({ shortCode });
//     if (!doc) return null;

//     const data = doc.toObject();
//     this._cacheSet(shortCode, data);
//     return { ...data, fromCache: false };
//   }

//   /**
//    * Increment click counter in MongoDB
//    */
//   async incrementClicks(shortCode) {
//     const doc = await Url.findOneAndUpdate(
//       { shortCode },
//       { $inc: { clicks: 1 }, lastAccessed: new Date() },
//       { new: true }
//     );
//     if (doc) this._cacheSet(shortCode, doc.toObject());
//   }

//   async exists(shortCode) {
//     const cached = this._cacheGet(shortCode);
//     if (cached) return true;
//     const doc = await Url.findOne({ shortCode }).select('shortCode');
//     return !!doc;
//   }

//   // --- Cache internals (LRU) ---

//   _cacheGet(key) {
//     if (!this.cache.has(key)) return null;
//     const val = this.cache.get(key);
//     this.cache.delete(key);
//     this.cache.set(key, val);
//     return val;
//   }

//   _cacheSet(key, value) {
//     if (this.cache.size >= this.cacheMaxSize) {
//       this.cache.delete(this.cache.keys().next().value);
//     }
//     this.cache.set(key, value);
//   }

//   async getStats() {
//     const totalUrls = await Url.countDocuments();
//     const nodeDistribution = {};
//     for (const nodeId of this.ring.nodes) {
//       const count = await Url.countDocuments({ node: nodeId });
//       nodeDistribution[nodeId] = count;
//     }

//     return {
//       totalUrls,
//       nodeDistribution,
//       cacheSize: this.cache.size,
//       cacheHits: this.cacheHits,
//       cacheMisses: this.cacheMisses,
//       cacheHitRate: this.cacheHits + this.cacheMisses > 0
//         ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1) + '%'
//         : '0%',
//       hashRing: this.ring.getStats(),
//       mongoConnected: mongoose.connection.readyState === 1,
//     };
//   }

//   addNode(nodeId) {
//     this.ring.addNode(nodeId);
//     return `Node ${nodeId} added to ring.`;
//   }
// }

// module.exports = DistributedStorage;
const ConsistentHashRing = require('./consistentHashing');
const Url = require('./models/Url');

class DistributedStorage {
  constructor() {
    this.ring = new ConsistentHashRing(150);

    ['node-1', 'node-2', 'node-3'].forEach(node =>
      this.ring.addNode(node)
    );

    this.cache = new Map();
    this.cacheMaxSize = 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  async set(shortCode, data) {
    const primaryNode = this.ring.getNode(shortCode);
    const nodes = this.ring.getNodes(shortCode, 2);
    const replicaNode = nodes[1] || primaryNode;

    this._cacheSet(shortCode, {
      shortCode,
      originalUrl: data.originalUrl,
      primaryNode,
      replicaNode
    });

    return {
      primaryNode,
      replicaNode
    };
  }

  async get(shortCode) {
    const cached = this._cacheGet(shortCode);

    if (cached) {
      this.cacheHits++;
      return {
        ...cached,
        fromCache: true
      };
    }

    this.cacheMisses++;

    const doc = await Url.findOne({
      shortCode,
      isActive: true
    });

    if (!doc) return null;

    const data = doc.toObject();

    this._cacheSet(shortCode, data);

    return {
      ...data,
      fromCache: false
    };
  }

  async incrementClicks(shortCode) {
    const doc = await Url.findOneAndUpdate(
      { shortCode },
      {
        $inc: { clicks: 1 },
        lastAccessed: new Date()
      },
      { new: true }
    );

    if (doc) {
      this._cacheSet(shortCode, doc.toObject());
    }
  }

  async exists(shortCode) {
    const cached = this._cacheGet(shortCode);

    if (cached) return true;

    const doc = await Url.findOne({
      shortCode
    }).select('shortCode');

    return !!doc;
  }

  _cacheGet(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const value = this.cache.get(key);

    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  _cacheSet(key, value) {
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
  }

  async getStats() {
    const totalUrls = await Url.countDocuments();

    const nodeDistribution = {};

    for (const nodeId of this.ring.nodes) {
      const count = await Url.countDocuments({
        primaryNode: nodeId
      });

      nodeDistribution[nodeId] = count;
    }

    const totalRequests =
      this.cacheHits + this.cacheMisses;

    return {
      totalUrls,
      nodeDistribution,
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate:
        totalRequests > 0
          ? (
              (this.cacheHits / totalRequests) *
              100
            ).toFixed(1) + '%'
          : '0%',
      hashRing: this.ring.getStats()
    };
  }

  addNode(nodeId) {
    this.ring.addNode(nodeId);
  }
}

module.exports = DistributedStorage;