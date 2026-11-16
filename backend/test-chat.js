import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import { Message } from './models/Message.js';

const SERVER_URL = 'http://localhost:5001';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/our-chat';

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE CHAT ROOM TEST SUITE ---\n');

  // 1. Direct MongoDB connection verification
  console.log('Step 1: Checking MongoDB connection directly...');
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB directly.\n');

  // Clean test messages if needed, or leave existing
  const initialCount = await Message.countDocuments();
  console.log(`Initial message count in DB: ${initialCount}`);

  // Helper to create a client socket
  const createClient = (username) => {
    return new Promise((resolve, reject) => {
      const socket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      socket.on('connect', () => {
        resolve({ socket, username });
      });

      socket.on('connect_error', (err) => {
        reject(err);
      });
    });
  };

  // Helper to join room
  const joinRoom = ({ socket, username }) => {
    return new Promise((resolve) => {
      socket.emit('join-room', { username }, (res) => {
        resolve(res);
      });
    });
  };

  // 2. Connect 5 users
  console.log('\nStep 2: Connecting 5 distinct users...');
  const userNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan'];
  const clients = [];

  for (const name of userNames) {
    const client = await createClient(name);
    const joinRes = await joinRoom(client);
    console.log(`✓ ${name} joined:`, { success: joinRes.success, onlineCount: joinRes.onlineUsers?.length });
    if (!joinRes.success) {
      throw new Error(`Failed to join for ${name}: ${joinRes.error}`);
    }
    clients.push(client);
  }

  // 3. Test duplicate username rejection
  console.log('\nStep 3: Testing duplicate active username rejection...');
  const duplicateClient = await createClient('Alice');
  const duplicateRes = await joinRoom(duplicateClient);
  console.log('Duplicate join result for "Alice":', duplicateRes);
  if (duplicateRes.success) {
    throw new Error('Duplicate username was allowed! Expected failure.');
  }
  console.log('✓ Duplicate active username correctly rejected with error:', duplicateRes.error);
  duplicateClient.socket.disconnect();

  // 4. Test real-time message broadcasting and MongoDB persistence
  console.log('\nStep 4: Testing real-time message sending and reception...');
  const receivedMessages = new Map();
  userNames.forEach((name) => receivedMessages.set(name, []));

  clients.forEach(({ socket, username }) => {
    socket.on('receive-message', (data) => {
      receivedMessages.get(username).push(data);
    });
  });

  const testMessageText = `Hello everyone from Alice at ${new Date().toISOString()}`;
  await new Promise((resolve) => {
    clients[0].socket.emit('send-message', { message: testMessageText }, (res) => {
      console.log('Alice send acknowledgment:', res);
      resolve(res);
    });
  });

  // Give 500ms for all sockets to receive broadcast
  await new Promise((r) => setTimeout(r, 500));

  clients.forEach(({ username }) => {
    const msgs = receivedMessages.get(username);
    const found = msgs.some((m) => m.message === testMessageText && m.username === 'Alice');
    console.log(`✓ ${username} received message: ${found}`);
    if (!found) throw new Error(`${username} failed to receive Alice's message!`);
  });

  // Check MongoDB directly for message
  const savedInDb = await Message.findOne({ message: testMessageText });
  if (!savedInDb) throw new Error('Message was not saved in MongoDB!');
  console.log('✓ Verified message successfully saved in MongoDB with ID:', savedInDb._id);

  // 5. Test 6th user joining later and receiving complete chat history from MongoDB
  console.log('\nStep 5: Connecting 6th user (Fiona) who joins later...');
  const fiona = await createClient('Fiona');
  const fionaJoinRes = await joinRoom(fiona);

  console.log('Fiona join response history count:', fionaJoinRes.history?.length);
  const fionaSawAliceMessage = fionaJoinRes.history?.some((m) => m.message === testMessageText);
  console.log(`✓ Fiona received previous history from MongoDB: ${fionaSawAliceMessage}`);
  if (!fionaSawAliceMessage) throw new Error('Fiona did not receive previous message from history!');

  // Check online count after Fiona joins
  console.log('✓ Online users list seen by Fiona:', fionaJoinRes.onlineUsers);
  if (fionaJoinRes.onlineUsers.length !== 6) {
    throw new Error(`Expected 6 online users, got ${fionaJoinRes.onlineUsers.length}`);
  }

  // 6. Test user leaving and notifications
  console.log('\nStep 6: Testing user disconnection notification...');
  let evanLeftNotificationReceived = false;
  clients[0].socket.on('user-left', (data) => {
    if (data.username === 'Evan') {
      evanLeftNotificationReceived = true;
    }
  });

  const evanClient = clients.find((c) => c.username === 'Evan');
  evanClient.socket.disconnect();

  await new Promise((r) => setTimeout(r, 600));
  console.log(`✓ Received 'user-left' notification for Evan: ${evanLeftNotificationReceived}`);
  if (!evanLeftNotificationReceived) throw new Error('Failed to receive user-left notification!');

  // Clean up all test sockets
  clients.forEach((c) => c.socket.disconnect());
  fiona.socket.disconnect();
  await mongoose.disconnect();

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Real-time chat & MongoDB history fully verified!');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

