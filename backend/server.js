import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Message } from './models/Message.js';

dotenv.config();

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/our-chat';

const app = express();
const server = http.createServer(app);

// Enable CORS for Express and Socket.IO
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory mapping of active socket connections: socketId -> username
const onlineUsers = new Map();

// Helper to get array of unique active usernames
const getOnlineUsersList = () => {
  return Array.from(new Set(onlineUsers.values()));
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully at:', MONGODB_URI);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    onlineUsersCount: getOnlineUsersList().length,
  });
});

// Fetch all messages in chronological order
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 }).lean();
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.IO Connection & Events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Event: join-room
  socket.on('join-room', async (data, callback) => {
    try {
      const rawUsername = typeof data === 'string' ? data : data?.username;
      const username = rawUsername?.trim();

      // Validation
      if (!username) {
        const errorMsg = 'Username is required.';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('join-error', { error: errorMsg });
        return;
      }

      if (username.length < 2 || username.length > 25) {
        const errorMsg = 'Username must be between 2 and 25 characters.';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('join-error', { error: errorMsg });
        return;
      }

      // Check for duplicate active username (case-insensitive)
      const isDuplicate = Array.from(onlineUsers.values()).some(
        (u) => u.toLowerCase() === username.toLowerCase()
      );

      if (isDuplicate) {
        const errorMsg = `Username "${username}" is already in use by someone online.`;
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        socket.emit('join-error', { error: errorMsg });
        return;
      }

      // Register the active user
      onlineUsers.set(socket.id, username);

      // Fetch all historical messages from MongoDB in chronological order
      const history = await Message.find().sort({ timestamp: 1 }).lean();
      const currentOnlineUsers = getOnlineUsersList();

      // Acknowledge join success to the joining user with history and online list
      if (typeof callback === 'function') {
        callback({
          success: true,
          username,
          history,
          onlineUsers: currentOnlineUsers,
        });
      }
      socket.emit('joined-successfully', {
        username,
        history,
        onlineUsers: currentOnlineUsers,
      });

      // Notify other connected users that someone joined
      socket.broadcast.emit('user-joined', {
        username,
        timestamp: new Date().toISOString(),
      });

      // Broadcast updated online users list to everyone
      io.emit('online-users', currentOnlineUsers);

      console.log(`User "${username}" joined. Total online: ${currentOnlineUsers.length}`);
    } catch (err) {
      console.error('Error handling join-room:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Internal server error while joining.' });
      }
    }
  });

  // Event: send-message
  socket.on('send-message', async (data, callback) => {
    try {
      const username = onlineUsers.get(socket.id);

      if (!username) {
        const errorMsg = 'You must join the chat room before sending messages.';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        return;
      }

      const rawMessage = typeof data === 'string' ? data : data?.message;
      const messageText = rawMessage?.trim();

      if (!messageText) {
        const errorMsg = 'Message cannot be empty.';
        if (typeof callback === 'function') callback({ success: false, error: errorMsg });
        return;
      }

      // Save message to MongoDB
      const savedMessage = await Message.create({
        username,
        message: messageText,
        timestamp: new Date(),
      });

      const messagePayload = {
        _id: savedMessage._id.toString(),
        username: savedMessage.username,
        message: savedMessage.message,
        timestamp: savedMessage.timestamp.toISOString(),
      };

      // Broadcast message to everyone in the room (including sender)
      io.emit('receive-message', messagePayload);

      if (typeof callback === 'function') {
        callback({ success: true, message: messagePayload });
      }
    } catch (err) {
      console.error('Error saving or broadcasting message:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to send message.' });
      }
    }
  });

  // Event: disconnect
  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      const remainingUsers = getOnlineUsersList();

      console.log(`User "${username}" disconnected. Total online: ${remainingUsers.length}`);

      // Notify remaining users that someone left
      io.emit('user-left', {
        username,
        timestamp: new Date().toISOString(),
      });

      // Broadcast updated online users list
      io.emit('online-users', remainingUsers);
    } else {
      console.log(`Unregistered socket disconnected: ${socket.id}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

