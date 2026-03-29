const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const jwtConfig = require('./config/jwt');
const aiService = require('./modules/ai/ai.service');
const chatPermissionService = require('./services/chatPermission.service');
const db = require('./models');

const { AiConversation, AiMessage } = db.models;

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
    const userRole = socket.user?.role || 'student';
    
    if (userId != null) {
      socket.join(String(userId));
    }

    // Generic room join/leave
    socket.on('join', (room) => {
      if (room == null) return;
      if (typeof room === 'string' || typeof room === 'number') {
        socket.join(String(room));
        return;
      }
    });

    socket.on('leave', (room) => {
      if (room == null) return;
      if (typeof room === 'string' || typeof room === 'number') {
        socket.leave(String(room));
      }
    });

    // AI Chat Events
    socket.on('join_ai_conversation', async ({ conversationId }, callback) => {
      try {
        const convId = Number(conversationId);
        if (!Number.isFinite(convId)) {
          return callback?.({ success: false, error: 'conversationId không hợp lệ' });
        }

        // Verify user owns this conversation or is admin
        const conv = await AiConversation.findByPk(convId);
        if (!conv) {
          return callback?.({ success: false, error: 'Không tìm thấy conversation' });
        }

        if (Number(conv.userId) !== userId && userRole !== 'admin') {
          return callback?.({ success: false, error: 'Không có quyền truy cập' });
        }

        const roomName = `ai_conv_${convId}`;
        socket.join(roomName);
        socket.currentAIConversation = convId;

        // Notify others in room (for multi-device sync)
        socket.to(roomName).emit('user_joined_ai_chat', { userId });

        callback?.({ success: true, conversationId: convId });
      } catch (error) {
        console.error('join_ai_conversation error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('leave_ai_conversation', async ({ conversationId }, callback) => {
      try {
        const convId = Number(conversationId);
        const roomName = `ai_conv_${convId}`;
        
        socket.leave(roomName);
        socket.to(roomName).emit('user_left_ai_chat', { userId });
        delete socket.currentAIConversation;

        callback?.({ success: true });
      } catch (error) {
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('ai_send_message', async ({ conversationId, content, parentId }, callback) => {
      try {
        const convId = Number(conversationId);
        const msg = String(content || '').trim();

        if (!Number.isFinite(convId)) {
          return callback?.({ success: false, error: 'conversationId không hợp lệ' });
        }
        if (!msg) {
          return callback?.({ success: false, error: 'Nội dung không được trống' });
        }

        // Verify conversation exists and user has access
        const conv = await AiConversation.findByPk(convId);
        if (!conv) {
          return callback?.({ success: false, error: 'Không tìm thấy conversation' });
        }

        if (Number(conv.userId) !== userId && userRole !== 'admin') {
          return callback?.({ success: false, error: 'Không có quyền gửi tin nhắn' });
        }

        // Check chat permission
        const permissionCheck = await chatPermissionService.canChat(
          userId,
          conv.courseId,
          conv.lectureId,
          userRole
        );
        
        if (!permissionCheck.allowed) {
          return callback?.({ 
            success: false, 
            error: permissionCheck.reason || 'Bạn không có quyền chat',
            mutedUntil: permissionCheck.mutedUntil,
          });
        }

        const roomName = `ai_conv_${convId}`;

        // Save user message
        const userMessage = await AiMessage.create({
          conversationId: convId,
          sender: 'user',
          content: msg,
          parentId: parentId || null,
        });

        // Broadcast to room immediately
        io.to(roomName).emit('message_received', {
          message: userMessage,
          sender: 'user',
          timestamp: new Date().toISOString(),
        });

        // Acknowledge user message saved
        callback?.({ success: true, messageId: userMessage.id });

        // Emit AI typing indicator
        io.to(roomName).emit('ai_typing_start', { conversationId: convId });

        // Process AI response in background
        try {
          const result = await aiService.sendStudentMessage(userId, userRole, convId, msg);
          
          // Save AI response
          const aiMessage = await AiMessage.create({
            conversationId: convId,
            sender: 'ai',
            content: result.answer,
            parentId: userMessage.id,
          });

          // Broadcast AI response
          io.to(roomName).emit('ai_response', {
            message: aiMessage,
            answer: result.answer,
            sender: 'ai',
            timestamp: new Date().toISOString(),
            chunks: result.chunks, // RAG context chunks
          });
        } catch (aiError) {
          console.error('AI response error:', aiError);
          io.to(roomName).emit('ai_error', {
            conversationId: convId,
            error: aiError.message || 'AI không thể trả lời lúc này',
          });
        } finally {
          io.to(roomName).emit('ai_typing_stop', { conversationId: convId });
        }
      } catch (error) {
        console.error('ai_send_message error:', error);
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('ai_typing_start', ({ conversationId }) => {
      const roomName = `ai_conv_${conversationId}`;
      socket.to(roomName).emit('user_typing_start', { userId, conversationId });
    });

    socket.on('ai_typing_stop', ({ conversationId }) => {
      const roomName = `ai_conv_${conversationId}`;
      socket.to(roomName).emit('user_typing_stop', { userId, conversationId });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.currentAIConversation) {
        const roomName = `ai_conv_${socket.currentAIConversation}`;
        socket.to(roomName).emit('user_left_ai_chat', { userId });
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
