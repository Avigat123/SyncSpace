# SyncSpace 🚀

A high-performance, real-time collaborative document editing platform built with CRDTs (Conflict-free Replicated Data Types), TipTap, Yjs, React, Node.js, and WebSockets.

---

## 📑 Table of Contents
- [Overview](#-overview)
- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [WebSocket & CRDT Sync Protocol](#-websocket--crdt-sync-protocol)
- [API Reference](#-api-reference)

---

## 🌟 Overview

**SyncSpace** enables seamless, concurrent multi-user rich-text editing with sub-millisecond local updates and eventual consistency guarantees. Using **Yjs** CRDTs combined with **TipTap (ProseMirror)** and **Socket.IO**, users can edit documents simultaneously without lock contention or merge conflicts.

---

## 🏗️ Architecture

```
                      ┌────────────────────────────────────────┐
                      │             React Frontend             │
                      │  (TipTap Editor + Yjs Doc + Awareness) │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │ HTTP (REST API)               WebSocket (Socket.IO)
                 │ Auth, Documents, Sharing      Yjs CRDT Sync, Cursors, Presence
                 ▼                                               ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                      Node.js / Express Backend                  │
      │  ┌──────────────────────────┐    ┌───────────────────────────┐  │
      │  │   REST Controllers       │    │ Socket Handlers & Rooms   │  │
      │  │  - Auth (JWT / Cookies)  │    │  - Yjs Protocol Sync      │  │
      │  │  - Document CRUD         │    │  - Awareness (Cursors)    │  │
      │  └────────────┬─────────────┘    └─────────────┬─────────────┘  │
      │               │                                │                │
      │               │           ┌────────────────────┘                │
      │               ▼           ▼                                     │
      │       ┌───────────────────────────────┐                         │
      │       │     Yjs Document Service      │                         │
      │       │  - Binary Update Encoding     │                         │
      │       │  - Debounced DB Persistence   │                         │
      │       └───────────────┬───────────────┘                         │
      └───────────────────────┼─────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      ┌───────────────┐               ┌───────────────┐
      │    MongoDB    │               │     Redis     │
      │ Document Meta │               │ Pub/Sub &     │
      │ Yjs Snapshots │               │ Socket Scale  │
      └───────────────┘               └───────────────┘
```

### How Collaboration Works:
1. **Local-First Editing**: User keystrokes mutate local Yjs document state immediately (0ms UI latency).
2. **Delta Broadcast**: Local changes produce binary updates (`Uint8Array`) transmitted over Socket.IO rooms.
3. **Conflict-Free Merge**: Peers and backend server merge updates deterministically using Yjs CRDT math.
4. **Awareness & Presence**: Remote cursor positions, selections, and user tags are synchronized in real time.
5. **Debounced Persistence**: Backend periodically flushes merged document states and snapshots to MongoDB.

---

## ✨ Key Features

- ⚡ **Real-Time CRDT Collaboration**: Concurrent multi-user editing with zero merge conflicts.
- 👥 **Live Presence & Cursors**: Color-coded user carets, active selection highlights, and online indicators.
- 📝 **Rich Text Editing**: TipTap-powered formatting (Headings, bold/italic, lists, blockquotes, code blocks, etc.).
- 🔒 **Authentication & Authorization**: JWT-based auth, secure HTTP-only cookies, and role-based access (Owner, Editor, Viewer).
- 📁 **Document Management**: Create, rename, delete, organize, and share documents via email/link.
- 🕒 **Auto-Save & History**: Debounced state persistence and snapshot version history.
- 🐳 **Dockerized Setup**: Multi-container setup with Docker Compose (Frontend, Backend, MongoDB, Redis).

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, TipTap (ProseMirror), Yjs, React Router v7, Socket.IO Client, Vanilla CSS |
| **Backend** | Node.js, Express 5, Socket.IO, Yjs (`y-protocols`, `lib0`), Mongoose, JWT, bcryptjs |
| **Databases** | MongoDB (Document storage & user accounts), Redis (Pub/Sub & session state) |
| **DevOps** | Docker, Docker Compose, Nodemon |

---

## 📂 Project Structure

```
SyncSpace/
├── backend/
│   ├── src/
│   │   ├── config/          # DB & Redis configurations
│   │   ├── controllers/     # REST API route handlers
│   │   ├── middlewares/     # JWT auth, error handling, validation
│   │   ├── models/          # Mongoose schemas (User, Document)
│   │   ├── routes/          # API route definitions (/auth, /documents)
│   │   ├── services/        # Yjs document & persistence services
│   │   ├── socket/          # Socket.IO connection, auth, & CRDT sync handlers
│   │   └── server.js        # Server entry point
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios/fetch API client modules
│   │   ├── collaboration/   # Yjs provider & TipTap collaboration extensions
│   │   ├── components/      # UI components (Editor, Toolbar, Navbar, Modals)
│   │   ├── context/         # Auth & document context providers
│   │   ├── hooks/           # Custom hooks (useCollaborativeEditor, usePresence)
│   │   ├── pages/           # Views (Dashboard, Editor, Login, Register)
│   │   └── App.jsx          # Root component & routing
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml       # Multi-container orchestration (App, Mongo, Redis)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **npm** or **yarn**
- **MongoDB** & **Redis** (Local instance or Docker)

---

### Option 1: Running with Docker Compose (Recommended)

To start the entire stack (Frontend, Backend, MongoDB, Redis) in one command:

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`

---

### Option 2: Local Development Setup

#### 1. Clone & Configure Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

#### 2. Configure & Run Frontend
```bash
cd ../frontend
npm install
npm run dev
```

---

## ⚙️ Environment Variables

Create `.env` in `backend/`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/syncspace
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```

---

## 🔌 WebSocket & CRDT Sync Protocol

SyncSpace utilizes a lightweight protocol on top of Socket.IO:

| Event | Direction | Description |
| :--- | :--- | :--- |
| `join-document` | Client ➔ Server | Join document room with document ID and token |
| `sync-step-1` | Client ➔ Server | Client sends state vector to request missing updates |
| `sync-step-2` | Server ➔ Client | Server responds with diff updates |
| `sync-update` | Bidirectional | Live binary CRDT edit deltas |
| `awareness-update` | Bidirectional | Cursor coordinates, selection ranges, user metadata |
| `cursor-move` | Client ➔ Server | Real-time caret coordinates |
| `typing` | Client ➔ Server | Broadcasts user typing indicator |

---

## 📡 API Reference

### Auth Routes (`/api/auth`)
- `POST /register` — Register a new user
- `POST /login` — Authenticate and receive session token / cookie
- `POST /logout` — Clear session
- `GET /me` — Get current authenticated user profile

### Document Routes (`/api/documents`)
- `GET /` — List user documents
- `POST /` — Create a new document
- `GET /:id` — Fetch document metadata & content
- `PUT /:id` — Update document title / content
- `DELETE /:id` — Delete a document
- `POST /:id/share` — Share document access with other users

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).