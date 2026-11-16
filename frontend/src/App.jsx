import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Send,
  Users,
  LogOut,
  MessageSquare,
  UserCheck,
  AlertCircle,
  Radio,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react';

// Automatically detect host IP/localhost for seamless local and multi-device LAN testing
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && window.location.hostname
    ? `http://${window.location.hostname}:5001`
    : 'http://localhost:5001');

// Deterministic colors for usernames & avatars
const AVATAR_COLORS = [
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
];

const TEXT_COLORS = [
  'text-emerald-400',
  'text-sky-400',
  'text-violet-400',
  'text-amber-400',
  'text-rose-400',
  'text-cyan-400',
  'text-purple-400',
  'text-teal-400',
  'text-indigo-400',
  'text-pink-400',
];

const getColorIndex = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
};

// Format timestamp cleanly
const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
};

export default function App() {
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [joinError, setJoinError] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showMobileUsers, setShowMobileUsers] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isJoined) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isJoined]);

  // Connect socket and handle events when joining
  const handleJoinChat = (e) => {
    e?.preventDefault();
    const trimmed = username.trim();

    if (!trimmed) {
      setJoinError('Please enter a username.');
      return;
    }

    if (trimmed.length < 2) {
      setJoinError('Username must be at least 2 characters.');
      return;
    }

    if (trimmed.length > 25) {
      setJoinError('Username cannot exceed 25 characters.');
      return;
    }

    setJoinError('');
    setIsConnecting(true);

    // Initialize or reuse socket connection
    let socket = socketRef.current;
    if (!socket || !socket.connected) {
      socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000,
      });
      socketRef.current = socket;
    }

    // Set up listeners
    socket.off('receive-message');
    socket.off('user-joined');
    socket.off('user-left');
    socket.off('online-users');
    socket.off('join-error');
    socket.off('disconnect');

    socket.on('receive-message', (data) => {
      setMessages((prev) => [...prev, { ...data, type: 'message' }]);
    });

    socket.on('user-joined', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}-${Math.random()}`,
          type: 'system',
          action: 'join',
          username: data.username,
          text: `${data.username} joined the room`,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);
    });

    socket.on('user-left', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}-${Math.random()}`,
          type: 'system',
          action: 'leave',
          username: data.username,
          text: `${data.username} left the room`,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);
    });

    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    socket.on('join-error', (data) => {
      setJoinError(data.error || 'Failed to join chat.');
      setIsConnecting(false);
    });

    socket.on('disconnect', () => {
      // If server disconnects
      console.log('Socket disconnected from server');
    });

    // Send join-room with callback acknowledgement
    socket.emit('join-room', { username: trimmed }, (response) => {
      setIsConnecting(false);
      if (response?.success) {
        setCurrentUsername(response.username || trimmed);
        setIsJoined(true);
        // Load MongoDB message history
        const formattedHistory = (response.history || []).map((msg) => ({
          ...msg,
          type: 'message',
        }));
        setMessages(formattedHistory);
        setOnlineUsers(response.onlineUsers || []);
        // Focus message input on join
        setTimeout(() => inputRef.current?.focus(), 150);
      } else {
        setJoinError(response?.error || 'Username is already taken by an active user.');
      }
    });
  };

  // Send message
  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('send-message', { message: text });
    setInputText('');
    inputRef.current?.focus();
  };

  // Leave chat / switch user
  const handleLeaveChat = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsJoined(false);
    setCurrentUsername('');
    setMessages([]);
    setOnlineUsers([]);
    setJoinError('');
  };

  // ----------------------------------------------------
  // SCREEN 1: Welcome & Username Entry Screen
  // ----------------------------------------------------
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100">
        {/* Subtle decorative glowing background accents */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl z-10">
          {/* Logo / Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 mb-4 text-white">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Our Chat</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Private group real-time chat for friends & team
            </p>
          </div>

          {/* Error Banner */}
          {joinError && (
            <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{joinError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleJoinChat} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Choose Your Username
              </label>
              <input
                id="username"
                type="text"
                autoFocus
                disabled={isConnecting}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (joinError) setJoinError('');
                }}
                placeholder="e.g. Alex, Sarah, David..."
                maxLength={25}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 text-base"
              />
            </div>

            <button
              type="submit"
              disabled={isConnecting || !username.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Joining room...</span>
                </>
              ) : (
                <>
                  <span>Join Chat</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Info Features */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant access • No password or signup required</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Radio className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Persistent MongoDB history • Live Socket.IO sync</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SCREEN 2: Main Chat Room Screen
  // ----------------------------------------------------
  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. Header */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-white leading-tight">Our Chat</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-400">Small group shared room</p>
          </div>
        </div>

        {/* Right side of header */}
        <div className="flex items-center gap-2.5">
          {/* Online count pill */}
          <button
            onClick={() => setShowMobileUsers(!showMobileUsers)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs sm:text-sm font-medium text-slate-200 border border-slate-700/60 transition-colors cursor-pointer"
            title="Toggle user list"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>
              {onlineUsers.length} <span className="hidden xs:inline">online</span>
            </span>
          </button>

          {/* Leave Room Button */}
          <button
            onClick={handleLeaveChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/50 hover:text-red-400 hover:border-red-500/30 text-xs sm:text-sm font-medium text-slate-300 border border-slate-700/50 transition-colors cursor-pointer"
            title="Leave chat"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* 2. Middle Body: Chat Messages Area + Online Users Sidebar */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Main Message Stream */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            {/* History notice */}
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-300">No messages yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Be the first to say hello to everyone in the room!
                </p>
              </div>
            ) : (
              <div className="text-center pb-2">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium tracking-wide bg-slate-900/80 text-slate-400 border border-slate-800">
                  Beginning of chat history
                </span>
              </div>
            )}

            {/* Message and System Notification List */}
            {messages.map((item, index) => {
              if (item.type === 'system') {
                const isJoin = item.action === 'join';
                return (
                  <div key={item.id || index} className="flex justify-center my-2">
                    <div
                      className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium border backdrop-blur-xs ${
                        isJoin
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20'
                          : 'bg-slate-900/80 text-slate-400 border-slate-800'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isJoin ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span>{item.text}</span>
                      {item.timestamp && (
                        <span className="text-[10px] opacity-70 ml-1">
                          {formatTime(item.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Normal User Message
              const isOwnMessage =
                item.username &&
                item.username.toLowerCase() === currentUsername.toLowerCase();
              const colorIdx = getColorIndex(item.username);
              const avatarClasses = AVATAR_COLORS[colorIdx];
              const senderColor = TEXT_COLORS[colorIdx];

              return (
                <div
                  key={item._id || index}
                  className={`flex items-end gap-2.5 ${
                    isOwnMessage ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Avatar for other users */}
                  {!isOwnMessage && (
                    <div
                      className={`w-8 h-8 rounded-full border shrink-0 flex items-center justify-center text-xs font-bold uppercase select-none ${avatarClasses}`}
                    >
                      {item.username?.charAt(0) || '?'}
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                      isOwnMessage
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    {/* Header info (sender name and timestamp) */}
                    <div
                      className={`flex items-baseline gap-2 mb-1 text-xs ${
                        isOwnMessage ? 'justify-end' : 'justify-between'
                      }`}
                    >
                      {!isOwnMessage && (
                        <span className={`font-semibold ${senderColor}`}>
                          {item.username}
                        </span>
                      )}
                      <span
                        className={`text-[11px] ${
                          isOwnMessage ? 'text-blue-100/75' : 'text-slate-400'
                        }`}
                      >
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p className="text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap">
                      {item.message}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 3. Sticky Bottom Input Bar */}
          <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message... (Press Enter to send)"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-3 sm:px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center shrink-0"
                title="Send message"
              >
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline sm:ml-2">Send</span>
              </button>
            </form>
          </div>
        </main>

        {/* Desktop Connected Users Sidebar */}
        <aside className="w-64 border-l border-slate-800 bg-slate-900/60 backdrop-blur-sm hidden md:flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Online Members ({onlineUsers.length})
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {onlineUsers.map((user) => {
              const isSelf = user.toLowerCase() === currentUsername.toLowerCase();
              const colorIdx = getColorIndex(user);
              const avatarClasses = AVATAR_COLORS[colorIdx];

              return (
                <div
                  key={user}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                    isSelf
                      ? 'bg-blue-950/40 border border-blue-500/20 text-white'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold uppercase ${avatarClasses}`}
                    >
                      {user.charAt(0)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                  </div>

                  <span className="text-sm font-medium truncate flex-1">{user}</span>

                  {isSelf && (
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/30">
                      You
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Mobile Slide-over Drawer for Online Users */}
        {showMobileUsers && (
          <div className="absolute inset-0 z-30 flex md:hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-4/5 max-w-xs h-full bg-slate-900 border-r border-slate-800 flex flex-col p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white">
                    Online Users ({onlineUsers.length})
                  </h2>
                </div>
                <button
                  onClick={() => setShowMobileUsers(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {onlineUsers.map((user) => {
                  const isSelf = user.toLowerCase() === currentUsername.toLowerCase();
                  const colorIdx = getColorIndex(user);
                  const avatarClasses = AVATAR_COLORS[colorIdx];

                  return (
                    <div
                      key={user}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                        isSelf
                          ? 'bg-blue-950/50 border border-blue-500/30 text-white'
                          : 'text-slate-300'
                      }`}
                    >
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold uppercase ${avatarClasses}`}
                        >
                          {user.charAt(0)}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                      </div>
                      <span className="text-sm font-medium truncate flex-1">{user}</span>
                      {isSelf && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300">
                          You
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex-1" onClick={() => setShowMobileUsers(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
