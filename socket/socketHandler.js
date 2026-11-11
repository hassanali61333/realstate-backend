const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// userId -> Set of socket ids (a user may be connected from several tabs/devices)
const onlineUsers = new Map();

const roomOf = (conversationId) => `conv:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;

/** Loads a conversation and checks the user belongs to it. Returns null otherwise. */
const loadConversationFor = async (conversationId, userId) => {
  if (!conversationId) return null;
  const convo = await Conversation.findById(conversationId);
  if (!convo) return null;
  const uid = userId.toString();
  if (convo.buyer.toString() !== uid && convo.agent.toString() !== uid) return null;
  return convo;
};

/** Small summary pushed to both participants so their chat list stays current. */
const summary = (convo) => ({
  _id: convo._id,
  lastMessage: convo.lastMessage,
  unreadAgent: convo.unreadAgent,
  unreadBuyer: convo.unreadBuyer,
  updatedAt: convo.updatedAt,
});

module.exports = (io) => {
  // ---- Socket auth via JWT handshake ----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name role');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Personal room: lets us notify a user about any conversation
    socket.join(userRoom(userId));

    // ---- onlineUsers ----
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit('onlineUsers', [...onlineUsers.keys()]);

    // ---- joinRoom ----
    socket.on('joinRoom', async (conversationId, ack) => {
      try {
        const convo = await loadConversationFor(conversationId, userId);
        if (!convo) return ack && ack({ ok: false, message: 'Conversation not found' });
        socket.join(roomOf(conversationId));
        ack && ack({ ok: true });
      } catch (err) {
        ack && ack({ ok: false, message: 'Could not join conversation' });
      }
    });

    socket.on('leaveRoom', (conversationId) => {
      socket.leave(roomOf(conversationId));
    });

    // ---- sendMessage ----
    socket.on('sendMessage', async (payload = {}, ack) => {
      try {
        const { conversationId } = payload;
        const text = (payload.text || '').trim();
        const image = typeof payload.image === 'string' ? payload.image : '';

        if (!text && !image) return ack && ack({ ok: false, message: 'Empty message' });
        if (text.length > 2000) return ack && ack({ ok: false, message: 'Message too long' });
        if (image && !/^\/uploads\/chat\/[\w.-]+$/.test(image)) {
          return ack && ack({ ok: false, message: 'Invalid image path' });
        }

        const convo = await loadConversationFor(conversationId, userId);
        if (!convo) return ack && ack({ ok: false, message: 'Conversation not found' });

        const message = await Message.create({
          conversation: convo._id,
          sender: userId,
          text,
          image,
        });

        // Update last message + the recipient's unread counter
        const senderIsAgent = convo.agent.toString() === userId;
        convo.lastMessage = { text, image, sender: userId, createdAt: message.createdAt };
        if (senderIsAgent) convo.unreadBuyer += 1;
        else convo.unreadAgent += 1;
        await convo.save();

        // Everyone viewing the thread gets the message...
        io.to(roomOf(convo._id)).emit('newMessage', message);
        // ...and both users' chat lists (even if the thread isn't open) get a summary
        io.to(userRoom(convo.buyer.toString()))
          .to(userRoom(convo.agent.toString()))
          .emit('conversationUpdated', summary(convo));

        ack && ack({ ok: true, message });
      } catch (err) {
        console.error('sendMessage error:', err.message);
        ack && ack({ ok: false, message: 'Could not send message' });
      }
    });

    // ---- typing / stopTyping ----
    socket.on('typing', ({ conversationId } = {}) => {
      socket.to(roomOf(conversationId)).emit('typing', {
        conversationId,
        userId,
        name: socket.user.name,
      });
    });

    socket.on('stopTyping', ({ conversationId } = {}) => {
      socket.to(roomOf(conversationId)).emit('stopTyping', { conversationId, userId });
    });

    // ---- markRead (read receipts + reset unread badge) ----
    socket.on('markRead', async ({ conversationId } = {}, ack) => {
      try {
        const convo = await loadConversationFor(conversationId, userId);
        if (!convo) return ack && ack({ ok: false });

        await Message.updateMany(
          { conversation: convo._id, sender: { $ne: userId }, read: false },
          { $set: { read: true } }
        );

        if (convo.agent.toString() === userId) convo.unreadAgent = 0;
        else convo.unreadBuyer = 0;
        // keep updatedAt untouched ordering-wise: only counters changed
        await convo.save({ timestamps: false });

        io.to(roomOf(convo._id)).emit('messagesRead', { conversationId, readerId: userId });
        io.to(userRoom(userId)).emit('conversationUpdated', summary(convo));
        ack && ack({ ok: true });
      } catch (err) {
        ack && ack({ ok: false });
      }
    });

    // ---- disconnect ----
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) onlineUsers.delete(userId);
      }
      io.emit('onlineUsers', [...onlineUsers.keys()]);
    });
  });
};
