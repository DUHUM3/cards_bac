const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

// =============== روتات تفعيل الكروت ===============

// روت تفعيل كرت بواسطة username فقط (المطلوب)
router.post('/activate', cardController.activateCard);

// روت تفعيل كرت بواسطة التوكن (بديل)
// router.post('/activate-by-token', cardController.activateCardByToken);

// =============== روتات إدارة الكروت ===============

// روت جلب جميع كروت المستخدم (بواسطة التوكن أو username)
// router.get('/my-cards', cardController.getUserCards);

// روت نقل كرت إلى مستخدم آخر
// router.post('/transfer', cardController.transferCard);

// روت جلب تفاصيل كرت محدد
// router.get('/:card_number', cardController.getCardDetails);

module.exports = router;