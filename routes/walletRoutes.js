const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// روت إنشاء محفظة لمستخدم موجود
router.post('/', walletController.createWallet);

// روت جلب محفظة مستخدم
router.get('/:user_id', walletController.getWalletByUserId);

// يمكنك إضافة راوتات أخرى للمحفظة هنا
// router.put('/:id', walletController.updateWallet);
// router.delete('/:id', walletController.deleteWallet);
// router.post('/transfer', walletController.transferBalance);

module.exports = router;