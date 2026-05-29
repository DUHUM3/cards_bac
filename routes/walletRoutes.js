const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// روت إنشاء محفظة لمستخدم موجود
router.post('/', walletController.createWallet);

// روت جلب محفظة مستخدم (باستخدام user_id)
router.get('/user/:user_id', walletController.getWalletByUserId);

// روت جلب محفظة بالـ ID
router.get('/:id', walletController.getWalletById);

// روت تحديث الرصيد بالكامل (PUT)
router.put('/:id/balance', walletController.updateWalletBalance);

// روت إضافة رصيد (POST) - شحن المحفظة
router.post('/:id/add', walletController.addBalance);

// روت سحب رصيد (POST) - خصم من المحفظة
router.post('/:id/deduct', walletController.deductBalance);

// روت حذف محفظة
router.delete('/:id', walletController.deleteWallet);

// روت تحويل رصيد بين محفظتين
router.post('/transfer', walletController.transferBalance);

module.exports = router;