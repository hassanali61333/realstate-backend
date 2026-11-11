const router = require('express').Router();
const ctrl = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { propertyUpload } = require('../middleware/upload');

// Public browsing
router.get('/', ctrl.getProperties);

// Agent-only (declare /mine BEFORE /:id)
router.get('/mine', protect, restrictTo('agent'), ctrl.getMyProperties);
router.post('/', protect, restrictTo('agent'), propertyUpload.array('images', 8), ctrl.createProperty);

router.get('/:id', ctrl.getProperty);
router.put('/:id', protect, restrictTo('agent'), propertyUpload.array('images', 8), ctrl.updateProperty);
router.delete('/:id', protect, restrictTo('agent'), ctrl.deleteProperty);

module.exports = router;
