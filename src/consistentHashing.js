

const crypto = require('crypto');

class ConsistentHashRing {
  constructor(virtualNodes = 150) {
    this.virtualNodes = virtualNodes; //More virtual nodes = better distribution
    this.ring = new Map();           //hash->nodeId
    this.sortedHashes = [];          //sorted list of hashes on the ring
    this.nodes = new Set();
  }

  
  _hash(key) {
    return parseInt(
      crypto.createHash('md5').update(key).digest('hex').substring(0, 8),
      16
    );
  }


  addNode(nodeId) {
    if (this.nodes.has(nodeId)) return;
    this.nodes.add(nodeId);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeId}:vnode:${i}`;
      const hash = this._hash(virtualKey);
      this.ring.set(hash, nodeId);
      this.sortedHashes.push(hash);
    }

    //Keephashessorted for binary search
    this.sortedHashes.sort((a, b) => a - b);
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    this.nodes.delete(nodeId);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeId}:vnode:${i}`;
      const hash = this._hash(virtualKey);
      this.ring.delete(hash);
      const idx = this.sortedHashes.indexOf(hash);
      if (idx !== -1) this.sortedHashes.splice(idx, 1);
    }
  }

  getNode(key) {
    if (this.nodes.size === 0) throw new Error('No nodes in ring');

    const hash = this._hash(key);

    // Binary search for the first hash >= our key's hash
    let lo = 0, hi = this.sortedHashes.length - 1;
    let targetIdx = -1;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.sortedHashes[mid] >= hash) {
        targetIdx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    // Wrap around if needed
    if (targetIdx === -1) targetIdx = 0;

    const targetHash = this.sortedHashes[targetIdx];
    return this.ring.get(targetHash);
  }

  /**
   * Get N nodes for replication (used for fault tolerance)
   */
  getNodes(key, count = 1) {
    if (this.nodes.size === 0) throw new Error('No nodes in ring');
    count = Math.min(count, this.nodes.size);

    const hash = this._hash(key);
    let lo = 0, hi = this.sortedHashes.length - 1;
    let startIdx = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.sortedHashes[mid] >= hash) {
        startIdx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    const result = new Set();
    let idx = startIdx;

    while (result.size < count) {
      const nodeId = this.ring.get(this.sortedHashes[idx % this.sortedHashes.length]);
      result.add(nodeId);
      idx++;
    }

    return Array.from(result);
  }

  getStats() {
    const distribution = {};
    for (const nodeId of this.nodes) distribution[nodeId] = 0;
    for (const nodeId of this.ring.values()) distribution[nodeId]++;
    return {
      nodes: Array.from(this.nodes),
      virtualSlotsPerNode: this.virtualNodes,
      totalSlots: this.sortedHashes.length,
      distribution
    };
  }
}

module.exports = ConsistentHashRing;
