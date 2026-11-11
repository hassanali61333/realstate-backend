const router = require('express').Router();
const ctrl = require('../controllers/chatController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { chatUpload } = require('../middleware/upload');

router.use(protect);

router.post('/conversations', restrictTo('buyer'), ctrl.getOrCreateConversation);
router.get('/conversations', ctrl.getConversations);
router.get('/conversations/:id/messages', ctrl.getMessages);
router.get('/unread-count', ctrl.getUnreadCount);
router.post('/upload', chatUpload.single('image'), ctrl.uploadChatImage);

module.exports = router;
