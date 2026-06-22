# SnapLink — Distributed URL Shortener

A production-inspired URL shortener demonstrating core distributed systems concepts.
Built with Node.js + Express. No external dependencies beyond npm packages.

## Architecture

```
Client Request
      │
      ▼
┌─────────────┐
│  Express    │  ← Rate Limiting (token bucket per IP)
│  Server     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  LRU Cache  │  ← Check cache first (O(1) lookup)
│  (in-memory)│
└──────┬──────┘
       │ cache miss
       ▼
┌────────────────────┐
│ Consistent Hash    │  ← Determine which shard owns this key
│ Ring (150 vnodes)  │
└────────┬───────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Node-1 │ │ Node-2 │ │ Node-3 │  ← Storage shards
│ (Map)  │ │ (Map)  │ │ (Map)  │  ← Each has replicated data too
└────────┘ └────────┘ └────────┘
```

## Key Distributed Systems Concepts

### 1. Consistent Hashing
- **Problem it solves:** With simple modulo hashing (`hash(key) % N`), adding or removing a node requires remapping ALL keys.
- **How it works:** Place nodes on a virtual ring. Each key maps to the first node clockwise from its hash position.
- **Result:** When a node is added/removed, only `K/N` keys need remapping (K = total keys, N = nodes).
- **Virtual nodes:** Each physical node gets 150 positions on the ring for better load distribution.

### 2. LRU Cache Layer
- Simulates a Redis cache in front of the storage nodes.
- Cache hit = O(1) lookup, avoids hitting the storage layer.
- Eviction policy: Least Recently Used (oldest entries evicted when full).

### 3. Replication
- Every URL is written to a primary node AND a replica node.
- On read failure, the system falls back to replica nodes.
- Simulates how distributed DBs (Cassandra, DynamoDB) achieve fault tolerance.

### 4. Rate Limiting
- Per-IP rate limiting: max 10 URL creations per minute.
- Prevents abuse and simulates real-world API protection.

## Running Locally

```bash
npm install
npm start
# Visit http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/shorten` | Create a short URL |
| `GET` | `/:code` | Redirect to original URL |
| `GET` | `/api/info/:code` | Get URL metadata |
| `GET` | `/api/stats` | Cluster stats + request log |
| `POST` | `/api/add-node` | Add a new storage node |

### POST /api/shorten
```json
{
  "url": "https://example.com/very/long/path",
  "customCode": "mylink"  // optional
}
```

### Response
```json
{
  "shortUrl": "http://localhost:3000/aB3xY7k",
  "shortCode": "aB3xY7k",
  "originalUrl": "https://example.com/very/long/path",
  "primaryNode": "node-2",
  "replicaNode": "node-1"
}
```

## What to Mention in Interviews

- **Why consistent hashing over modulo?** Modulo requires full remap on node change; consistent hashing remaps only 1/N of keys.
- **Why virtual nodes?** Without them, physical nodes may cluster together on the ring causing unequal load.
- **Why LRU cache?** Read-heavy workloads (like URL redirects) benefit enormously — most popular URLs served from memory.
- **Why replicate?** Single node = single point of failure. Replication gives fault tolerance.
- **Trade-offs:** This is AP (Availability + Partition Tolerance) per CAP theorem — we prioritize availability over strong consistency.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Rate Limiting:** express-rate-limit
- **ID Generation:** nanoid (Base62, URL-safe)
- **URL Validation:** valid-url
