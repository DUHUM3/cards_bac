const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const walletRoutes = require('./walletRoutes');

// استخدام الراوتات المختلفة
router.use('/users', userRoutes);
router.use('/wallets', walletRoutes);

module.exports = router;