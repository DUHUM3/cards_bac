const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// روت إنشاء مستخدم جديد (إضافة مستخدم)
router.post('/', userController.createUser);

// روت جلب جميع المستخدمين
router.get('/', userController.getAllUsers);

// روت جلب مستخدم محدد بال ID
router.get('/:id', userController.getUserById);

// روت تحديث بيانات مستخدم
router.put('/:id', userController.updateUser);

// روت حذف مستخدم (اختياري)
router.delete('/:id', userController.deleteUser);

// روت البحث عن مستخدمين (اختياري متقدم)
router.get('/search/advanced', userController.searchUsers);

module.exports = router;