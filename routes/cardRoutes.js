const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

// =============== روتات إنشاء الكروت ===============

// روت إنشاء كرت جديد
router.post('/create', cardController.createCard);

// =============== روتات تفعيل الكروت ===============

// روت تفعيل كرت بواسطة username فقط (المطلوب)
router.post('/activate', cardController.activateCard);

// =============== روتات إدارة الكروت ===============

// روت جلب جميع كروت المستخدم (بواسطة التوكن أو username)
// router.get('/my-cards', cardController.getUserCards);

// روت نقل كرت إلى مستخدم آخر
// router.post('/transfer', cardController.transferCard);

// روت جلب تفاصيل كرت محدد
// router.get('/:card_number', cardController.getCardDetails);

module.exports = router;