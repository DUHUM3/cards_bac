const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const walletRoutes = require('./walletRoutes');
const cardsRoutes = require('./cardRoutes');
// استخدام الراوتات المختلفة
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);
router.use('/cards', cardsRoutes);

module.exports = router;
