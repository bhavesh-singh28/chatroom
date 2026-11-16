# Our Chat 💬

A lightweight, modern, real-time group chat application built for a small group of 5–6 people.

Designed for simplicity, speed, and reliability with no passwords, registrations, or complicated setups required.

---

## 🚀 Features

- **Instant Join**: Enter a username and connect immediately to the shared chat room.
- **Duplicate Prevention**: Rejects duplicate active usernames among currently online users.
- **Real-Time Messaging**: Built with Socket.IO for sub-millisecond bidirectional messaging.
- **Persistent Chat History**: Messages are permanently saved in MongoDB and loaded chronologically when joining.
- **Active Member Tracking**: Live online counter and sidebar showing connected members with live status indicators and `(You)` badge.
- **System Notifications**: Clean, unobtrusive alerts when users join or leave the room.
- **Modern Dark Interface**: Tailored dark theme with distinct styling for own messages vs. other members' messages.
- **Multi-Device & Responsive**: Fully responsive layout for desktop, tablets, and mobile phones with collapsible user drawer.
- **Zero Registration**: No emails, passwords, JWT tokens, or authentication friction.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, Mongoose, CORS, Dotenv
- **Database**: MongoDB (Local or MongoDB Atlas)

---

## 🚀 Deployment (Render + Netlify)

For a complete walkthrough with screenshots and tips, see [DEPLOYMENT.md](file:///Users/bhavesh/Work/chatroom/DEPLOYMENT.md).

### 1. Database (MongoDB Atlas)
1. Create a free shared cluster (**M0**) at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`).
3. Under **Database Access**, create a database user and copy your connection string:
   `mongodb+srv://<user>:<password>@cluster.mongodb.net/our-chat?retryWrites=true&w=majority`

### 2. Backend on Render
1. Go to [render.com](https://render.com) ➔ **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<your MongoDB Atlas connection URI>`
5. Click **Deploy Web Service** and copy your backend URL (e.g. `https://our-chat-backend.onrender.com`).

### 3. Frontend on Netlify
1. Go to [netlify.com](https://netlify.com) ➔ **Add new site** ➔ **Import an existing project**.
2. Connect your GitHub repository (pre-configured by `netlify.toml`):
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Add Environment Variable:
   - `VITE_SERVER_URL`: `https://our-chat-backend.onrender.com` *(no trailing slash)*
4. Click **Deploy site**.

---

## 📁 Project Structure

```
chatroom/
├── backend/
│   ├── models/
│   │   └── Message.js         # Mongoose schema (username, message, timestamp)
│   ├── server.js              # Express + Socket.IO server + in-memory user tracking
│   ├── test-chat.js           # Automated multi-client integration test suite
│   ├── .env                   # Backend environment configuration
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Welcome screen + Chat interface + Socket client
│   │   ├── main.jsx           # React DOM root entry
│   │   └── index.css          # Tailwind CSS v4 styles + custom scrollbars
│   ├── index.html             # HTML entry point
│   ├── vite.config.js         # Vite configuration with Tailwind CSS plugin & LAN host
│   ├── .env                   # Frontend environment configuration
│   ├── .env.example
│   └── package.json
├── package.json               # Root scripts to run backend and frontend concurrently
└── README.md
```

---

## ⚙️ Prerequisites

1. **Node.js** (v18 or higher recommended; verified on Node v25)
2. **MongoDB** running locally on port `27017` (default: `mongodb://127.0.0.1:27017/our-chat`) or a remote MongoDB Atlas connection URI.

---

## 📥 Installation

You can install all dependencies across root, backend, and frontend with a single command:

```bash
# Clone or navigate to the project directory
cd /path/to/chatroom

# Install all dependencies (root, backend, and frontend)
npm run install:all
```

Alternatively, install individually:

```bash
# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

---

## 🔧 Environment Configuration

### Backend (`backend/.env`)
```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/our-chat
```

### Frontend (`frontend/.env`)
```env
# Optional: defaults to http://localhost:5001 or detects host IP automatically
VITE_SERVER_URL=http://localhost:5001
```

---

## 🏃 Running the Application

### Option 1: Start Both with One Command (Recommended)

From the project root:

```bash
npm run dev
```

This starts:
- **Backend server**: `http://localhost:5001`
- **Frontend client**: `http://localhost:5173`

---

### Option 2: Run Backend and Frontend Separately

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

## 🧪 Testing the Application

### 1. Automated Integration Test Suite
The project includes an automated multi-client test suite simulating 6 concurrent users (`Alice`, `Bob`, `Charlie`, `Diana`, `Evan`, `Fiona`):

```bash
cd backend
node test-chat.js
```

What the test suite verifies:
1. Connects 5 users concurrently and registers active sockets.
2. Rejects active duplicate username attempts (`Alice` rejected while Alice is online).
3. Alice sends a real-time message; verifies all other 4 users receive it instantly.
4. Verifies message persistence in MongoDB.
5. 6th user (`Fiona`) joins later and receives full previous MongoDB history.
6. User disconnects; verifies `user-left` notification and updated online count.

### 2. Multi-Tab Testing (Same Machine)
1. Open `http://localhost:5173` in Browser Tab 1. Enter `Alex` and click **Join Chat**.
2. Open `http://localhost:5173` in Browser Tab 2 (or Incognito). Enter `Sarah` and click **Join Chat**.
3. Send messages from either tab — notice instantaneous delivery, distinct message bubbles, sender avatars, and timestamps.
4. Try opening Tab 3 and entering `Alex` — notice the duplicate username rejection.
5. Close Tab 2 — observe `Sarah left the room` notification and the online member count decrementing.

### 3. Multi-Device LAN Testing (Phone / Another Computer)
Because `vite.config.js` sets `host: true` and the client detects `window.location.hostname`:
1. Find your machine's local IP (e.g. `192.168.1.100` or the Network URL printed by Vite).
2. Open `http://<YOUR-IP>:5173` on your smartphone connected to the same Wi-Fi.
3. Join and chat seamlessly between your computer and mobile device in real time!

---

## 📡 Socket.IO Events Reference

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `join-room` | Client ➔ Server | `{ username: string }` | Requests to join the public chat room. Validates name, checks duplicates, returns history and online users. |
| `joined-successfully` | Server ➔ Client | `{ username, history, onlineUsers }` | Confirmation sent to joining socket with full chat history and active users. |
| `send-message` | Client ➔ Server | `{ message: string }` | Sends a message. Server saves to MongoDB and broadcasts. |
| `receive-message` | Server ➔ All Clients | `{ _id, username, message, timestamp }` | Broadcasts newly saved message to all connected clients. |
| `user-joined` | Server ➔ Other Clients | `{ username, timestamp }` | Notifies active users when someone new joins. |
| `user-left` | Server ➔ All Clients | `{ username, timestamp }` | Notifies active users when a member disconnects. |
| `online-users` | Server ➔ All Clients | `string[]` | Broadcasts updated array of currently connected usernames. |
| `join-error` | Server ➔ Client | `{ error: string }` | Emitted when username is empty or already in use online. |
# chatroom
