# SyncSpace 🚀

**A real-time collaborative document editor built with React, TipTap, Yjs, Socket.IO, Node.js, Express, MongoDB, and Redis.**

SyncSpace is a full-stack collaborative document editing platform that allows multiple users to work on the same document simultaneously. It uses Yjs CRDTs for conflict-free synchronization, Socket.IO for real-time communication, and MongoDB for durable document persistence.

The project focuses on understanding production-oriented backend engineering, distributed systems, real-time collaboration, data consistency, and scalable application architecture.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Features and Implementation Status](#-features-and-implementation-status)
- [System Architecture](#-system-architecture)
- [How Collaboration Works](#-how-collaboration-works)
- [Authentication and Authorization](#-authentication-and-authorization)
- [Yjs Persistence Architecture](#-yjs-persistence-architecture)
- [Snapshot Compaction](#-snapshot-compaction)
- [Version History and Restoration](#-version-history-and-restoration)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [REST API Reference](#-rest-api-reference)
- [Socket.IO Events](#-socketio-events)
- [Important Design Decisions](#-important-design-decisions)
- [Known Limitations and Future Work](#-known-limitations-and-future-work)
- [License](#-license)

---

## 🌟 Overview

Traditional collaborative editors can encounter synchronization problems when multiple users modify the same document simultaneously. Replacing the entire document after every edit can cause concurrent changes to overwrite one another.

SyncSpace addresses this using **Yjs**, a CRDT (Conflict-free Replicated Data Type) framework that allows independent document changes to be merged.

The application uses:

- **Yjs** to maintain shared collaborative document state.
- **TipTap** to provide a rich-text editing experience.
- **Socket.IO** to transmit real-time updates between clients and servers.
- **MongoDB** to store document metadata, Yjs snapshots, and individual update records.
- **Redis** to distribute Socket.IO events and Yjs updates across backend instances.

### Core objectives

- Enable simultaneous editing without last-write-wins document replacement.
- Synchronize collaborative changes in real time.
- Persist Yjs updates independently of the active in-memory document.
- Recover collaborative documents after server restarts.
- Provide document ownership, sharing, and role-based permissions.
- Maintain version history and support restoration.
- Build a foundation for horizontal scaling and production deployment.

---

## ✨ Features and Implementation Status

| Feature | Status |
|---|---|
| User registration and login | Implemented |
| JWT authentication | Implemented |
| Document CRUD APIs | Implemented |
| Document sharing | Implemented |
| Owner, Editor and Viewer permissions | Implemented |
| Socket.IO authentication | Implemented |
| Document rooms | Implemented |
| Real-time Yjs synchronization | Implemented and tested |
| TipTap collaborative editor integration | Implemented |
| Live awareness and presence | Implemented |
| Document title synchronization | Implemented |
| Live collaborator role updates | Implemented |
| Live access revocation | Implemented |
| Version history | Implemented |
| Version restoration | Implemented and tested |
| Redis Pub/Sub integration | Implemented |
| Socket.IO Redis adapter | Implemented |
| Cross-instance Socket.IO broadcasting | Tested |
| Individual Yjs update persistence | Implemented and tested |
| Transactional update sequence allocation | Implemented |
| Snapshot-based document recovery | Implemented and tested |
| Unique compound update index | Implemented |
| Manual Yjs snapshot compaction | Implemented and tested |
| Automatic threshold-based snapshot compaction | Implemented and tested |
| Distributed persistence hardening | Remaining work |
| Production deployment | Planned |

*Implementation status reflects development and testing progress. It does not imply that every feature is production-ready.*

### Key capabilities

- **Real-time collaboration:** Multiple users can edit a shared document using Yjs.
- **Rich-text editing:** TipTap provides the editor interface.
- **Live presence:** Awareness synchronization supports collaboration metadata such as cursor and selection information.
- **Authentication:** JWT-based authentication protects application and socket operations.
- **Role-based permissions:** Owners, editors, and viewers have different access levels.
- **Durable persistence:** Individual Yjs updates are recorded in MongoDB.
- **Document recovery:** The server reconstructs a Y.Doc from its stored snapshot and subsequent update records.
- **Version history:** Users can create and restore document snapshots.
- **Multi-instance communication:** Redis distributes Socket.IO events between backend instances.
- **Snapshot compaction:** Persisted updates can be consolidated into a new snapshot to reduce update-log growth.

---

## 🏗️ System Architecture

### High-level architecture

```text
                     React Frontend
                           |
               +-----------+-----------+
               |                       |
            REST API                Socket.IO
               |                       |
               v                       v
         Express Backend          Socket Handlers
               |                       |
       +-------+--------+              |
       |                |              v
       v                v        Server-side Y.Doc
  Auth Services   Document Services    |
       |                |              |
       +----------------+--------------+
                       |
              +--------+--------+
              |                 |
              v                 v
           MongoDB             Redis
              |                 |
      +-------+--------+        |
      |       |        |        |
      v       v        v        v
  Documents  Yjs    Versions  Pub/Sub
  Metadata  Updates            |
      |       |                |
      +-------+----------------+
                       |
                 Socket.IO Redis
                    Adapter
                       |
              Other Backend Instances
```

### Main components

| Component | Responsibility |
|---|---|
| React | Frontend application and UI |
| TipTap | Rich-text editing |
| Yjs | Collaborative document state and conflict resolution |
| Socket.IO Client | Real-time communication |
| Express | HTTP APIs and middleware |
| Socket.IO Server | Connection management and document rooms |
| Server-side Y.Doc | Active in-memory collaborative state |
| MongoDB | Application data and durable Yjs persistence |
| Redis Pub/Sub | Cross-instance Yjs update propagation |
| Socket.IO Redis Adapter | Cross-instance Socket.IO event broadcasting |

### Two communication paths

**1. REST API — Application operations**

Used for authentication, document CRUD, sharing, permissions, version history, and restoration.

**2. Socket.IO — Real-time collaboration**

Used for joining document rooms, synchronizing Yjs updates, awareness synchronization, and notifying connected users about document changes.

Keeping these communication paths separate makes the application easier to maintain and extend.

---

## 🔄 How Collaboration Works

### 1. Local editing

A user types into the TipTap editor. The editor is connected to a shared Y.Doc through the TipTap Collaboration extension.

Changes are reflected locally without waiting for the server.

### 2. Yjs generates an update

Yjs tracks the change and generates a binary update represented as a `Uint8Array`.

### 3. Frontend sends the update

The frontend sends the update through Socket.IO using the `sync-yjs` event.

Conceptually:

```javascript
socket.emit("sync-yjs", {
    documentId,
    update: Array.from(update),
    generation,
});
```

The generation identifies the current document version and helps reject stale updates after restoration.

### 4. Backend validates and persists the update

The backend:

1. Validates document membership and editing permissions.
2. Checks the document generation.
3. Allocates a sequence number.
4. Persists the update in MongoDB.
5. Applies the update to the active server-side Y.Doc.
6. Publishes the update through Redis.
7. Broadcasts the update through Socket.IO.

The update record is persisted before the update is accepted into the server-side collaborative state.

### 5. Other clients receive the update

Other clients receive `yjs-update` and apply the binary update to their local Y.Doc.

Yjs merges concurrent changes using its CRDT mechanisms.

### Collaboration flow

```text
User Types
    |
    v
TipTap Editor
    |
    v
Frontend Y.Doc
    |
    v
Yjs Update
    |
    v
Socket.IO: sync-yjs
    |
    v
Backend Validation
    |
    v
MongoDB Update Persistence
    |
    v
Backend Y.Doc
    |
    +-----------> Redis Pub/Sub
    |                    |
    v                    v
Socket.IO Broadcast   Other Backend Instances
    |                    |
    +--------------------+
             |
             v
        Other Clients
             |
             v
      Apply Yjs Update
```

**Important:** Socket.IO transports events, Redis distributes messages, Yjs manages collaborative state, and MongoDB provides durable persistence. Each component has a separate responsibility.

---

## 🔐 Authentication and Authorization

SyncSpace uses JWT-based authentication.

The backend verifies authenticated users before allowing protected application operations and socket connections.

### Authentication responsibilities

- User registration and login.
- JWT generation and verification.
- Protected REST API access.
- Socket authentication.
- Document-level authorization.

### Document roles

| Role | Permissions |
|---|---|
| Owner | Full control over the document |
| Editor | Can view and modify the document |
| Viewer | Can view but cannot modify the document |

The backend checks document permissions before accepting collaborative editing operations.

Socket authentication alone does not grant access to every document. Document membership and role checks are also required.

---

## 💾 Yjs Persistence Architecture

One of the most important parts of SyncSpace is its durable Yjs persistence architecture.

The application uses a combination of **Yjs snapshots and individual update records** instead of depending exclusively on an in-memory document.

### 1. Document snapshot

The `documents` collection stores the latest compacted Yjs state.

Relevant fields:

| Field | Purpose |
|---|---|
| `yjsState` | Encoded Yjs snapshot |
| `generation` | Current document generation |
| `updateSequence` | Latest persisted update sequence |
| `snapshotSequence` | Latest sequence included in the snapshot |

### 2. Individual Yjs updates

The `yjsupdates` collection stores individual collaborative updates.

Each record contains:

| Field | Purpose |
|---|---|
| `document` | Reference to the document |
| `generation` | Generation associated with the update |
| `sequence` | Update sequence number |
| `update` | Binary Yjs update |
| `createdAt` | Creation timestamp |

The compound index is:

```javascript
{
    document: 1,
    generation: 1,
    sequence: 1
}
```

It is configured as a **unique index**, preventing duplicate sequence entries within the same document generation.

### 3. Transactional update persistence

The `persistYjsUpdate()` service performs two operations inside a MongoDB transaction:

1. Atomically increments `updateSequence`.
2. Inserts the corresponding Yjs update record.

Both operations commit together.

If inserting the update fails, the sequence increment is rolled back as well.

The generation filter also prevents outdated clients from persisting updates after a document restoration.

### 4. Document recovery

When a document is loaded, `loadYDoc()`:

1. Opens a MongoDB transaction.
2. Reads the document snapshot and sequence counters.
3. Retrieves update records belonging to the same generation.
4. Selects updates after `snapshotSequence` and up to `updateSequence`.
5. Reconstructs the Y.Doc by applying the snapshot and then the updates in sequence order.

Conceptually:

```text
MongoDB Document
       |
       v
Read Yjs Snapshot
       |
       v
Read Sequence Counters
       |
       v
Fetch Updates After Snapshot
       |
       v
Sort Updates by Sequence
       |
       v
Create New Y.Doc
       |
       v
Apply Snapshot
       |
       v
Replay Remaining Updates
       |
       v
Recovered Y.Doc
```

The snapshot and update records are read in the same transaction to obtain a consistent database view.

This allows the backend to recover document state without depending on a previous server process's memory.

---

## 📦 Snapshot Compaction

As users edit documents, individual Yjs updates accumulate in the `yjsupdates` collection.

Keeping every update indefinitely can increase storage usage and recovery time.

SyncSpace implements **automatic threshold-based snapshot compaction** to consolidate persisted updates into a new snapshot. Compaction is triggered when the number of updates after the latest snapshot reaches the configured threshold.

### Compaction process

1. Read the current document and its sequence counters.
2. Retrieve updates not yet included in the snapshot.
3. Verify that the expected update records are present.
4. Reconstruct the complete Y.Doc.
5. Encode the reconstructed state into a new snapshot.
6. Update `yjsState` and `snapshotSequence`.
7. Delete update records already included in the snapshot.

### Compaction flow

```text
Existing Snapshot
       +
Uncompacted Update Log
       |
       v
Reconstruct Complete Y.Doc
       |
       v
Encode New Snapshot
       |
       v
Update Document Snapshot
       |
       v
Update snapshotSequence
       |
       v
Delete Included Update Records
       |
       v
Compacted Document
```

### Transaction safety

Snapshot replacement and deletion of included update records happen inside the same MongoDB transaction.

This ensures that the new snapshot and corresponding update-log cleanup commit together.

The service also checks that the update log is complete before advancing the snapshot sequence. The snapshot update and deletion of included update records are committed together, so a failed transaction does not leave a partially compacted document.

### Compaction verification

Manual compaction was tested using an existing SyncSpace document. The test reconstructed the document before and after compaction and compared the resulting Yjs state.

| Metric | Before | After |
|---|---:|---:|
| Generation | 0 | 0 |
| Snapshot sequence | 0 | 5 |
| Update sequence | 5 | 5 |
| Update records | 5 | 0 |
| Updates replayed during recovery | 5 | 0 |

The test also verified:

```text
State vector preserved: true
Encoded state preserved: true
```

This confirms that the reconstructed Yjs state was preserved through the tested compaction and recovery cycle.

**Current status:** Manual and automatic threshold-based compaction are implemented and tested. Automatic compaction was exercised with a temporary lower threshold during testing; the production threshold is configured at 100 pending updates. Further distributed persistence hardening and multi-instance failure testing remain future work.

---

## 🕒 Version History and Restoration

SyncSpace supports creating document snapshots and restoring previously saved versions.

### Creating a version

1. Load the active Y.Doc.
2. Encode the current Yjs state.
3. Save the snapshot in the Version collection.
4. Store the document reference, title, author, and timestamp.

### Restoring a version

The restore process:

1. Validates the requested version.
2. Verifies that the version belongs to the requested document.
3. Reconstructs a Y.Doc from the stored snapshot.
4. Persists the restored state.
5. Resets the update and snapshot sequence counters.
6. Increments the document generation.
7. Removes the previous cached Y.Doc.
8. Publishes a Redis restore notification.
9. Notifies connected clients through Socket.IO.
10. Allows clients to reconnect to the restored document state.

### Why generations matter

A client may still hold an older document state after a restoration.

The generation mechanism helps the backend reject updates associated with an outdated generation.

This prevents old editing sessions from silently writing into the restored document generation.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Rich-text editor | TipTap, ProseMirror |
| Collaborative state | Yjs |
| Real-time communication | Socket.IO |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JWT |
| Cross-instance communication | Redis Pub/Sub |
| Socket.IO scaling | Redis Adapter |
| Containerization | Docker |
| Development | npm, Nodemon |

---

## 📂 Project Structure

The following represents the main application structure. Some modules may be added or reorganized as development continues.

```text
SyncSpace/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── redis.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   └── document.controller.js
│   │   │
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   ├── documentPermission.middleware.js
│   │   │   └── error.middleware.js
│   │   │
│   │   ├── models/
│   │   │   ├── user.model.js
│   │   │   ├── document.model.js
│   │   │   ├── version.model.js
│   │   │   └── yjsUpdate.model.js
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── document.routes.js
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── document.service.js
│   │   │   ├── yjs.service.js
│   │   │   ├── yjsUpdate.service.js
│   │   │   ├── yjsCompaction.service.js
│   │   │   └── versionRestore.service.js
│   │   │
│   │   ├── socket/
│   │   │   ├── socketAuth.js
│   │   │   ├── socketInstance.js
│   │   │   ├── document.socket.js
│   │   │   ├── yjsRedis.js
│   │   │   ├── yjsStore.js
│   │   │   ├── awarenessStore.js
│   │   │   └── handlers/
│   │   │       ├── joinDocument.js
│   │   │       ├── syncYjs.js
│   │   │       ├── syncAwareness.js
│   │   │       └── disconnect.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── collaboration/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── README.md
└── structure.txt
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB Atlas or a MongoDB replica-set deployment
- Redis
- Docker (optional)
- Git

**Important:** The current persistence implementation uses MongoDB transactions. Use a MongoDB deployment that supports transactions, such as MongoDB Atlas or a properly configured replica set.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd SyncSpace
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
NODE_ENV=development
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

Use the environment variable names expected by your actual configuration.

Never commit real credentials or secrets.

### 3. Start Redis

If using Docker:

```bash
docker run -d \
  --name syncspace-redis \
  -p 6379:6379 \
  redis:7-alpine
```

If the container already exists, start it with:

```bash
docker start syncspace-redis
```

### 4. Start the backend

```bash
npm run dev
```

The backend should connect to MongoDB and Redis before starting the HTTP server.

### 5. Configure the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend API base URL according to the API client implementation.

Example:

```env
VITE_API_URL=http://localhost:5000/api
```

### 6. Test collaboration

1. Start the backend and frontend.
2. Register or log in.
3. Create a document.
4. Open the document in another browser session.
5. Give the second user access.
6. Edit from both sessions.
7. Verify that updates synchronize.
8. Reload the document and verify recovery.
9. Create a version snapshot.
10. Restore the snapshot and verify that connected clients receive the restoration notification.

---

## ⚙️ Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing and verification secret |
| `NODE_ENV` | Runtime environment |
| `CLIENT_URL` | Allowed frontend origin |
| `REDIS_URL` | Redis connection URL |
| `VITE_API_URL` | Frontend API base URL |

Use the exact variable names expected by the application source code.

---

## 📡 REST API Reference

The following is a high-level reference. Verify exact route names and request payloads against the current route and controller implementations.

### Authentication

Base path: `/api/auth`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/register` | Register a user |
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| GET | `/me` | Retrieve authenticated user |

### Documents

Base path: `/api/documents`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/` | Create a document |
| GET | `/` | List accessible documents |
| GET | `/:id` | Retrieve document |
| PUT | `/:id` | Update document fields |
| DELETE | `/:id` | Delete document |
| POST | `/:id/share` | Share document |
| GET | `/:id/history` | Retrieve version history |
| POST | `/:id/versions` | Create a version snapshot |
| POST | `/:documentId/history/:versionId/restore` | Restore a version |

---

## 🔌 Socket.IO Events

SyncSpace uses a custom Socket.IO event protocol.

| Event | Direction | Purpose |
|---|---|---|
| `join-document` | Client → Server | Join a document room |
| `document-generation` | Server → Client | Provide document generation |
| `sync-document` | Server → Client | Send initial Yjs state |
| `sync-yjs` | Client → Server | Submit a Yjs update |
| `yjs-update` | Server → Clients | Broadcast collaborative updates |
| `awareness-sync-request` | Client → Server | Request awareness synchronization |
| `awareness-update` | Bidirectional | Synchronize awareness information |
| `document-restored` | Server → Document room | Notify clients of restoration |
| `cursor-move` | Client → Server | Handle cursor movement, where used |
| `typing` | Client → Server | Handle typing indicators, where used |

The exact event payloads are defined by the frontend provider and backend socket handlers.

---

## 🧠 Important Design Decisions

### Why Yjs?

Yjs provides CRDT-based shared document state. It allows concurrent edits to be merged without relying on replacing the entire document after every change.

### Why Socket.IO?

Socket.IO provides event-based communication, rooms, reconnection support, and real-time broadcasting.

### Why MongoDB update logs?

Storing individual Yjs updates provides a durable history of changes since the latest snapshot. The server can reconstruct document state after a restart.

### Why snapshot compaction?

Replaying a very large update log on every document load can become expensive. Compaction consolidates the current state into a new snapshot and removes updates already included in that snapshot.

### Why Redis?

The Socket.IO Redis adapter allows broadcasts to reach clients connected to different backend instances. A separate Redis Pub/Sub channel propagates Yjs updates between backend instances so their local Y.Doc caches can stay synchronized.

Redis Pub/Sub is not itself durable storage. MongoDB remains the persistence layer.

### Why document generations?

Restoring a document changes its current state. Generation checks help reject updates from clients that still belong to an earlier document state.

---

## 🚧 Known Limitations and Future Work

SyncSpace has implemented several important backend systems, but further work is needed before production deployment.

### Backend persistence

- Add robust retry and failure handling.
- Test recovery after unexpected backend termination.
- Handle missed Redis Pub/Sub notifications and stale backend caches.
- Further harden concurrent update and restore operations.

### Distributed collaboration

- Test concurrent edits across multiple backend instances.
- Test document loading and restoration across instances.
- Improve distributed document coordination.
- Test reconnects and server failures under load.

### Frontend development

- Complete frontend authentication and API integration.
- Build the document dashboard.
- Build and polish the collaborative editor interface.
- Integrate live cursors and collaborator presence.
- Build sharing and permission management UI.
- Integrate version history and restoration UI.
- Improve responsive layouts and error handling.

### Security

- Validate all Socket.IO payloads.
- Review cookie security and CSRF protections.
- Rate-limit sensitive endpoints.
- Test all permission levels across REST and Socket.IO operations.

### Deployment

- Complete Docker configuration.
- Configure Nginx and reverse proxying.
- Add graceful shutdown and health checks.
- Set up HTTPS, logging, and monitoring.
- Deploy the frontend, backend, MongoDB, and Redis infrastructure.

---

## 📄 License

This project is licensed under the ISC License. See the `LICENSE` file for details.
