# SnapLink — Distributed URL Shortener

A production-inspired URL shortener demonstrating core distributed systems concepts.
Built with Node.js + Express. No external dependencies beyond npm packages.

## Architecture

Client Request
      │
      
┌─────────────┐
│  Express    │  ← Rate Limiting (token bucket per IP)
│  Server     │
└──────┬──────┘
       │
       
┌─────────────┐
│  LRU Cache  │  ← Check cache first (O(1) lookup)
│  (in-memory)│
└──────┬──────┘
       │ cache miss
       
┌────────────────────┐
│ Consistent Hash    │  ← Determine which shard owns this key
│ Ring (150 vnodes)  │
└────────┬───────────┘
         │
    ┌────┴────┐
             
┌────────┐ ┌────────┐ ┌────────┐
│ Node-1 │ │ Node-2 │ │ Node-3 │  ← Storage shards
│ (Map)  │ │ (Map)  │ │ (Map)  │  ← Each has replicated data too
└────────┘ └────────┘ └────────┘


## Key Distributed Systems Concepts

### 1. Consistent Hashing
### 2. LRU Cache Layer
### 3. Replication
### 4. Rate Limiting
## Tech Stack
### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose ODM

### Authentication & Security
- JWT (jsonwebtoken)
- bcryptjs (Password Hashing)
- cookie-parser
- express-rate-limit

### URL Shortening
- nanoid (Base62, URL-safe ID generation)
- valid-url (URL validation)

### Distributed Systems Concepts
- Consistent Hashing Ring
- Virtual Nodes
- Replication (Primary & Replica Nodes)
- In-Memory LRU Cache
- Fault Tolerance Simulation

### Development Tools
- Git & GitHub
- npm (Node Package Manager)
- REST APIs
