const router = require('express').Router();
const { signup, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);

module.exports = router;
 