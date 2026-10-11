# SyncSpace 🚀

**A real-time collaborative document editor built with React, TipTap, Yjs, Socket.IO, Node.js, Express, and MongoDB.**

SyncSpace allows multiple users to edit the same rich-text document simultaneously. It combines CRDT-based synchronization, live presence, secure authentication, role-based permissions, document sharing, and version history in a full-stack web application.

The project is being developed with a focus on understanding production backend architecture, real-time systems, data consistency, and scalable collaboration.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Features and Implementation Status](#-features-and-implementation-status)
- [Architecture](#-architecture)
- [How Collaboration Works](#-how-collaboration-works)
- [Authentication and Authorization](#-authentication-and-authorization)
- [Document Persistence](#-document-persistence)
- [Version History and Restoration](#-version-history-and-restoration)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [REST API Reference](#-rest-api-reference)
- [Socket.IO Event Reference](#-socketio-event-reference)
- [Important Design Decisions](#-important-design-decisions)
- [Known Limitations and Future Work](#-known-limitations-and-future-work)
- [License](#-license)

---

## 🌟 Overview

Traditional collaborative editors often send updated document content to a server and overwrite the previous version. When multiple users edit concurrently, this approach can cause changes to be lost.

SyncSpace uses **Yjs**, a CRDT (Conflict-free Replicated Data Type) framework, to maintain shared document state and merge concurrent edits.

Instead of treating every keystroke as a replacement of the entire document, the application propagates Yjs updates between connected clients. Socket.IO provides the real-time communication layer, while MongoDB stores document metadata and encoded Yjs snapshots.

The application also supports authenticated access, document ownership, editor/viewer permissions, live presence, and snapshot restoration.

### Core objectives

- Enable simultaneous editing without relying on last-write-wins document replacement.
- Synchronize changes between connected clients in real time.
- Persist collaborative state across browser reloads and server restarts.
- Protect documents using authentication and role-based authorization.
- Allow users to create snapshots and restore previous document versions.
- Build a foundation for future horizontal scaling and production deployment.

---

## ✨ Features and Implementation Status

| Feature | Status |
|---|---|
| User registration and login | Implemented |
| JWT authentication using HTTP-only cookies | Implemented |
| Authenticated frontend routes | Implemented |
| Document CRUD APIs | Implemented |
| Document sharing and role-based permissions | Implemented |
| Real-time editing with Yjs and Socket.IO | Implemented and tested |
| MongoDB persistence of Yjs state | Implemented and tested |
| Live presence and awareness synchronization | Implemented and tested |
| Manual version snapshot creation | Implemented and tested |
| Version history retrieval | Implemented |
| Snapshot restoration and editor remounting | Implemented and tested |
| Document-generation checks for stale updates | Implemented; further hardening needed |
| Redis-based multi-server collaboration | Planned |
| Production-grade concurrent persistence protection | Remaining work |
| Production deployment and load balancing | Planned |

*Status describes the current development progress, not a claim of production readiness. Re-test features after significant changes.*

### Key capabilities

- **Real-time collaborative editing:** Multiple users can edit the same document using Yjs CRDTs.
- **Rich-text editing:** TipTap provides the editor interface and ProseMirror document model.
- **Live presence:** Awareness messages synchronize collaboration metadata, such as cursor and selection information.
- **Secure authentication:** JWTs are delivered through HTTP-only cookies.
- **Document permissions:** Owners manage documents, editors modify them, and viewers receive read access.
- **Automatic persistence:** Changes are saved to MongoDB using a debounced persistence mechanism.
- **Version snapshots:** A user can create a snapshot of the current Yjs state and restore a previous snapshot.
- **Protected routes:** The frontend checks the authenticated user's session before displaying protected pages.

---

## 🏗️ Architecture

### High-level architecture

```text
                         React Frontend
                               |
                  +------------+------------+
                  |                         |
              REST API                 Socket.IO
                  |                         |
                  v                         v
           Express Backend          Socket Handlers
                  |                         |
       +----------+----------+              |
       |                     |              v
       v                     v        Server-side Y.Doc
  Auth Services       Document Services      |
       |                     |               |
       +----------+----------+---------------+
                  |
                  v
             MongoDB
                  |
       +----------+-----------+
       |                      |
       v                      v
 Document Metadata       Yjs Snapshots
 User Accounts           Version History

 Redis Pub/Sub and horizontal
 scaling: planned future work
```

### Main components

| Component | Responsibility |
|---|---|
| React | Application UI, routing, authentication state |
| TipTap | Rich-text editing and editor extensions |
| Yjs | Shared document state and CRDT conflict resolution |
| Socket.IO client | Sends and receives real-time collaboration events |
| Express | HTTP APIs, middleware, authentication, authorization |
| Socket.IO server | Connection management, document rooms, update broadcasts |
| Server-side Y.Doc | Holds the active in-memory collaborative state |
| MongoDB | Persists users, document metadata, Yjs state, and snapshots |
| Redis | Intended for cross-server event propagation and scaling |

### Two separate communication paths

**1. REST API — durable application operations**

Used for login, registration, document CRUD, sharing, fetching version history, creating snapshots, and restoring versions.

**2. Socket.IO — live collaboration**

Used for joining document rooms, synchronizing Yjs updates, sharing awareness information, and notifying connected users about document restoration.

Keeping these paths separate makes the system easier to maintain. HTTP handles application operations, while Socket.IO handles continuous real-time communication.

---

## 🔄 How Collaboration Works

Understanding this flow is the most important part of understanding SyncSpace.

### 1. The editor creates local changes

A user types into the TipTap editor. The editor is connected to a shared Yjs document through TipTap's Collaboration extension.

The change updates the local Yjs state immediately, so the user does not have to wait for the server before seeing their own typing.

### 2. Yjs generates an update

Yjs tracks the change and emits an update containing the information needed to synchronize the shared document state.

The update is binary data, represented as a `Uint8Array`.

### 3. The frontend sends the update

The frontend's Socket.IO provider listens for Yjs document updates and sends them to the backend using the `sync-yjs` event.

Conceptually:

```js
socket.emit("sync-yjs", {
  documentId,
  update: Array.from(update),
  generation,
});
```

The `generation` value identifies the current document session generation and is used to reject stale updates after restoration.

### 4. The backend applies and broadcasts the update

The server retrieves the active Y.Doc, validates the generation, applies the update, and broadcasts the update to other clients in the document room.

Conceptually:

```js
Y.applyUpdate(ydoc, binaryUpdate);

socket.to(documentId).emit(
  "yjs-update",
  Array.from(binaryUpdate)
);
```

This is an illustrative excerpt of the synchronization flow, not the complete production handler.

### 5. Other clients apply the update

Other connected clients receive `yjs-update` and apply the update to their own Y.Doc.

Yjs merges concurrent changes according to its CRDT rules. As clients receive the necessary updates, their shared document states converge.

### 6. The server persists the state

The backend schedules a debounced save. When the document remains idle for the configured interval, its encoded Yjs state is saved to MongoDB.

This avoids performing a database write for every individual keystroke.

### Collaboration flow at a glance

```text
User types
    |
    v
TipTap Editor
    |
    v
Frontend Y.Doc
    |
    v
Yjs update
    |
    v
Socket.IO: sync-yjs
    |
    v
Backend Y.Doc
    |
    +------> Broadcast yjs-update
    |                    |
    |                    v
    |              Other clients
    |                    |
    |                    v
    |              Apply Yjs update
    |
    v
Debounced persistence
    |
    v
MongoDB Yjs snapshot
```

**Important distinction:** Socket.IO transports updates; Yjs manages shared document state and conflict resolution. MongoDB provides persistence. None of these components replaces the responsibilities of the others.

---

## 🔐 Authentication and Authorization

SyncSpace uses JWT-based authentication with HTTP-only cookies.

### Authentication flow

1. A user registers or logs in through the REST API.
2. The backend validates the credentials.
3. A JWT containing the user's identifier is generated.
4. The server sets the JWT in an HTTP-only cookie.
5. The frontend sends credentials with requests.
6. Authentication middleware verifies the cookie and loads the authenticated user.
7. Protected frontend routes use the authentication context to decide whether to render the requested page.

### Why HTTP-only cookies?

HTTP-only cookies cannot be accessed through ordinary browser JavaScript. This reduces exposure of the token to certain token-theft attacks, although it does not eliminate XSS or CSRF risks.

The frontend should not read the JWT or store it in `localStorage`.

### Document roles

| Role | Permissions |
|---|---|
| Owner | Full control, including sharing and deletion |
| Editor | Can view and modify the document |
| Viewer | Can view but cannot modify the document |

Document permission middleware checks the user's access level before allowing protected document operations.

**Security requirement:** Socket connections must also be authenticated, and document-room joins must verify access to the requested document. Authentication alone does not prove that a user is allowed to access every document.

---

## 💾 Document Persistence

SyncSpace separates the active collaborative state from its durable database representation.

### Active state versus stored state

- **Active Y.Doc:** The in-memory Yjs document used by the running backend.
- **Stored Yjs state:** An encoded binary representation saved in MongoDB.
- **Document metadata:** Title, owner, collaborators, and other document fields.
- **Version snapshot:** A saved historical representation of the document state.

The active Y.Doc is cached in memory to avoid reloading the document from MongoDB for every update.

### Saving a Y.Doc

The persistence service encodes the shared state:

```js
const state = Y.encodeStateAsUpdate(ydoc);

await Document.findByIdAndUpdate(documentId, {
  yjsState: Buffer.from(state),
});
```

### Loading a Y.Doc

When a document is loaded, the service creates a new Y.Doc and applies the stored state:

```js
const ydoc = new Y.Doc();

if (document.yjsState?.length) {
  Y.applyUpdate(
    ydoc,
    new Uint8Array(document.yjsState)
  );
}
```

This reconstructs the collaborative state from the stored Yjs representation.

The TipTap Collaboration extension expects the appropriate shared Yjs structure. It is not safe to assume that an arbitrary `Y.Text` contains the rich-text content managed by TipTap's collaborative document.

### Why debounce persistence?

Writing to MongoDB after every keystroke can generate unnecessary database operations.

Debouncing postpones the save until updates stop arriving for a short interval. This reduces write frequency, but it introduces a durability window: recent changes may not yet have reached MongoDB if the process stops unexpectedly.

The persistence layer therefore needs careful handling of pending timers, restores, concurrent saves, and failures.

---

## 🕒 Version History and Restoration

SyncSpace supports manually creating snapshots and restoring previously saved versions.

### Creating a version

When a user creates a snapshot:

1. The backend loads the active Y.Doc.
2. The current state is encoded using `Y.encodeStateAsUpdate()`.
3. The document title and snapshot state are stored in the Version collection.
4. The version records the document, author, and creation time.

Conceptually:

```js
const yjsState = Y.encodeStateAsUpdate(ydoc);

await Version.create({
  document: document._id,
  title: document.title,
  content: document.content || "",
  editedBy: userId,
  yjsState: Buffer.from(yjsState),
});
```

The actual service also validates that the document exists.

### Restoring a version

The restore flow is:

1. Validate the document and requested version.
2. Verify that the version belongs to the document.
3. Ensure the version contains a Yjs snapshot.
4. Reconstruct a Y.Doc from the snapshot.
5. Persist the restored state and update the cached Y.Doc.
6. Increment the document generation.
7. Emit `document-restored` to the document's Socket.IO room.
8. Connected frontend pages update their title and remount the editor.
9. The new editor joins the document and receives its current state.

```text
User selects Restore
        |
        v
Backend validates snapshot
        |
        v
Reconstruct restored Y.Doc
        |
        v
Persist restored state
        |
        v
Replace cached Y.Doc
        |
        v
Increment generation
        |
        v
Emit document-restored
        |
        v
Frontend remounts editor
        |
        v
New provider joins and synchronizes
```

### Why document generations matter

Suppose a browser still holds a provider associated with the document state from before a restore. That provider may attempt to send an update based on an outdated editing session.

The generation check lets the backend reject updates carrying an older generation.

This is an additional safeguard; it is not a replacement for Yjs CRDT synchronization.

### Current limitation

The generation guard and debounced save logic are implemented, but **fully race-safe persistence is still a hardening task**. An older MongoDB write that has already started can still race with a restore. A production-ready solution needs serialized or otherwise coordinated persistence and restore operations.

Version snapshots also represent saved document states; they are not a complete event-by-event audit log.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Rich-text editor | TipTap, ProseMirror |
| Collaborative state | Yjs, `y-protocols` |
| Real-time transport | Socket.IO client and server |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JWT, HTTP-only cookies, bcryptjs |
| Development | npm, Nodemon |
| Containerization | Docker, Docker Compose |
| Future scaling | Redis Pub/Sub, multi-instance Socket.IO |

---

## 📂 Project Structure

The following is a guide to the main backend modules. The frontend structure is summarized by responsibility; check the repository for the exact current filenames.

```text
SyncSpace/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   └── document.controller.js
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   ├── documentPermission.middleware.js
│   │   │   └── error.middleware.js
│   │   ├── models/
│   │   │   ├── user.model.js
│   │   │   ├── document.model.js
│   │   │   └── version.model.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   └── document.routes.js
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── document.service.js
│   │   │   ├── yjs.service.js
│   │   │   ├── version.service.js
│   │   │   └── versionRestore.service.js
│   │   ├── socket/
│   │   │   ├── socketAuth.js
│   │   │   ├── socketInstance.js
│   │   │   ├── document.socket.js
│   │   │   ├── store.js
│   │   │   ├── yjsStore.js
│   │   │   ├── awarenessStore.js
│   │   │   └── handlers/
│   │   │       ├── joinDocument.js
│   │   │       ├── syncYjs.js
│   │   │       ├── syncAwareness.js
│   │   │       ├── CursorMove.js
│   │   │       ├── typing.js
│   │   │       └── disconnect.js
│   │   ├── utils/
│   │   │   ├── ApiError.js
│   │   │   ├── asyncHandler.js
│   │   │   └── generateToken.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── collaboration/
│   │   │   └── socketProvider.js
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
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── README.md
└── structure.txt
```

### Where to look when debugging

| Problem | Start here |
|---|---|
| Login or session issues | `auth.controller.js`, `auth.middleware.js`, `AuthContext.jsx` |
| Permission errors | `documentPermission.middleware.js` |
| Document CRUD issues | `document.controller.js`, `document.service.js` |
| Edits not synchronizing | `socketProvider.js`, `syncYjs.js`, `joinDocument.js` |
| Document state not loading | `yjs.service.js`, `yjsStore.js` |
| Edits disappear after restart | `yjs.service.js`, `syncYjs.js` |
| Cursors or presence not updating | `syncAwareness.js`, `awarenessStore.js` |
| Snapshot creation | `version.service.js`, `document.controller.js` |
| Snapshot restoration | `versionRestore.service.js`, `DocumentPage.jsx` |
| Socket connection issues | `socketAuth.js`, `socketInstance.js`, `document.socket.js` |

---

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- MongoDB, running locally or through Docker
- Git
- A modern browser

Redis is not required for the current single-server collaboration setup unless your local Compose configuration explicitly starts it.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd SyncSpace
```

Replace the placeholder with your repository URL.

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example` as a reference.

Example:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/syncspace
JWT_SECRET=replace_with_a_long_random_secret
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Use the variable names expected by your actual backend configuration. Keep secrets out of Git.

### 3. Start MongoDB

Make sure MongoDB is running and the connection URI points to the correct instance.

### 4. Start the backend

```bash
npm run dev
```

Check the terminal for successful server startup and database connection messages.

### 5. Configure and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

If your frontend API client uses `VITE_API_URL`, create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:5000/api
```

Use the port configured in your backend. The frontend and backend must agree on the API URL and cookie/CORS settings.

### 6. Test collaboration

1. Register or log in.
2. Create a document.
3. Open the same document in a second browser window.
4. Log in as a user with access to the document.
5. Edit in both windows and verify that changes synchronize.
6. Reload a browser and verify that persisted content loads.
7. Create a version snapshot, edit the document, and restore the snapshot.

### Docker Compose

The repository contains a `docker-compose.yml` and Dockerfiles. To use the containerized setup:

```bash
docker compose up --build
```

Check the actual Compose configuration for required environment variables, exposed ports, health checks, and which services are included. The command alone does not establish that every service is configured for production.

---

## ⚙️ Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend HTTP server port |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `NODE_ENV` | Runtime environment |
| `CLIENT_URL` | Allowed frontend origin for CORS |
| `VITE_API_URL` | Frontend API base URL |

Use the variable names required by your current source code. Never commit real secrets or production credentials.

---

## 📡 REST API Reference

The backend routes are protected by authentication middleware where appropriate.

Assuming the API prefix is `/api`, the current document API includes the following operations.

### Authentication — `/api/auth`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/register` | Register a user |
| POST | `/login` | Authenticate and set the session cookie |
| POST | `/logout` | Clear the session cookie |
| GET | `/me` | Retrieve the current user |

### Documents — `/api/documents`

| Method | Endpoint | Required access | Purpose |
|---|---|---|---|
| POST | `/` | Authenticated | Create a document |
| GET | `/` | Authenticated | List accessible documents |
| GET | `/:id` | Viewer or higher | Retrieve document information |
| PUT | `/:id` | Editor or owner | Update supported document fields |
| DELETE | `/:id` | Owner | Delete a document |
| POST | `/:id/share` | Owner | Share document access |
| GET | `/:id/history` | Viewer or higher | Retrieve version history |
| POST | `/:id/versions` | Editor or owner | Create a version snapshot |
| POST | `/:documentId/history/:versionId/restore` | Editor or owner | Restore a saved version |

The exact response bodies and sharing payload should be checked in the corresponding controller and service implementations.

---

## 🔌 Socket.IO Event Reference

SyncSpace uses a custom Socket.IO event protocol to coordinate document collaboration.

| Event | Direction | Purpose |
|---|---|---|
| `join-document` | Client → Server | Request to join a document room |
| `document-generation` | Server → Client | Provide the current document generation |
| `sync-document` | Server → Client | Send the initial Yjs state |
| `sync-yjs` | Client → Server | Submit a Yjs update and its generation |
| `yjs-update` | Server → Other clients | Broadcast a Yjs update |
| `awareness-sync-request` | Client/server | Request awareness synchronization |
| `awareness-update` | Bidirectional | Exchange cursor, selection, and user awareness data |
| `document-restored` | Server → Document room | Notify clients that a version was restored |
| `cursor-move` | Client → Server | Handle cursor movement, if used by the active client |
| `typing` | Client → Server | Handle typing indicators, if used by the active client |

The precise payload format is defined by the socket handlers and frontend provider. Check both sides when changing an event name or payload.

**Note:** This is the application's current custom protocol, not a claim that it implements every standard Yjs sync-protocol message such as `sync-step-1` and `sync-step-2`.

---

## 🧠 Important Design Decisions

### Why Yjs instead of sending the entire document?

Sending the entire document after each edit can cause unnecessary network traffic and lost updates when concurrent writes overwrite each other.

Yjs represents collaborative changes through CRDT updates and merges concurrent operations according to its data structures.

### Why Socket.IO?

Socket.IO provides event-based communication, rooms, reconnection support, and transport management. Rooms allow the backend to broadcast document updates to connected clients working on the same document.

### Why MongoDB?

MongoDB stores application entities and binary Yjs snapshots. The active Y.Doc remains in memory for efficient synchronization, while stored snapshots support persistence and restoration.

### Why debounce database writes?

Debouncing reduces unnecessary database operations during rapid typing. It must be combined with proper save coordination so pending or overlapping writes cannot overwrite a restored state.

### Why HTTP-only cookies?

They keep the JWT inaccessible to ordinary frontend JavaScript and reduce one avenue of token theft. Cookie-based authentication still requires careful CORS, SameSite, and CSRF configuration.

### Why document generations?

Restoring a snapshot replaces the server's active Y.Doc. Generation checks help reject updates from clients that still belong to the earlier document session. They complement CRDT synchronization; they do not replace it.

### Why Redis later?

A single Socket.IO server can manage its own rooms and connected clients. When multiple backend instances are introduced, clients may connect to different instances. Redis Pub/Sub or a suitable Socket.IO adapter can help distribute events across instances.

Redis alone does not solve distributed persistence, authentication, document ownership, or concurrency control.

---

## 🚧 Known Limitations and Future Work

The project is functional, but several areas need additional hardening before it should be described as production-ready.

### Persistence and consistency

- Serialize or otherwise coordinate database saves and version restores.
- Ensure an older in-flight save cannot overwrite a restored snapshot.
- Handle database failures, retries, and shutdown-time flushing.
- Consider migration for documents created before Yjs-state persistence was introduced.

### Collaboration and scaling

- Integrate Redis with Socket.IO when horizontal scaling is introduced.
- Coordinate document state across backend instances.
- Define a robust distributed document-loading and persistence strategy.
- Test reconnects, concurrent joins, and simultaneous edits under load.

### Security

- Review cookie security settings and CSRF protections.
- Validate all Socket.IO event payloads.
- Rate-limit sensitive endpoints and protect against abusive update traffic.
- Test every role against both REST endpoints and socket events.

### Testing and deployment

- Add automated tests for permissions, snapshots, restoration, and concurrent updates.
- Add integration tests for persistence and reconnect behavior.
- Add Docker health checks, structured logging, and graceful shutdown.
- Configure deployment, HTTPS, monitoring, and load balancing.

---

## 📄 License

This project is licensed under the ISC License. See the `LICENSE` file for details.
