const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const jwtConfig = require('./config/jwt');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
        .split(',')
        .map((o) => o.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, jwtConfig.secret);
      socket.user = decoded;
      return next();
    } catch (e) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    if (userId != null) {
      socket.join(String(userId));
    }

    socket.on('join', (room) => {
      if (room == null) return;
      // allow joining userId room only (backward compat with FE)
      if (typeof room === 'string' || typeof room === 'number') {
        socket.join(String(room));
        return;
      }
      // ignore other shapes for now
    });

    socket.on('leave', (room) => {
      if (room == null) return;
      if (typeof room === 'string' || typeof room === 'number') {
        socket.leave(String(room));
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

function emitNotification(userId, notification) {
  if (!io) return;
  io.to(String(userId)).emit('new_notification', notification);
}

module.exports = {
  initSocket,
  getIO,
  emitNotification,
};
