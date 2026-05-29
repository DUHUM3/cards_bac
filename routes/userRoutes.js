const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// روت إنشاء مستخدم جديد (إضافة مستخدم) - ينشئ توكن تلقائياً
router.post('/', userController.createUser);

// روت جلب جميع المستخدمين (مع معلومات التوكن)
router.get('/', userController.getAllUsers);

// روت جلب مستخدم محدد بال ID (مع معلومات التوكن)
router.get('/:id', userController.getUserById);

// روت تحديث بيانات مستخدم - لا يغير التوكن
router.put('/:id', userController.updateUser);

// روت حذف مستخدم (اختياري)
router.delete('/:id', userController.deleteUser);

// روت البحث عن مستخدمين (اختياري متقدم)
router.get('/search/advanced', userController.searchUsers);

// =============== الروتات الجديدة للتوكن ===============

// روت تجديد التوكن لمدة سنة كاملة
router.post('/:id/renew-token', userController.renewToken);

// روت التحقق من صلاحية التوكن
router.get('/verify-token/:token', userController.verifyToken);

// روت جلب معلومات المستخدم بواسطة التوكن
router.get('/token/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const pool = require('../db');
        
        const result = await pool.query(
            `SELECT 
                u.id,
                u.full_name,
                u.phone,
                u.region,
                u.user_type,
                u.settings,
                u.auth_token,
                u.token_expiry,
                CASE 
                    WHEN u.token_expiry > NOW() THEN true 
                    ELSE false 
                END as is_token_valid,
                COALESCE(w.balance, 0) as wallet_balance,
                w.id as wallet_id
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
            WHERE u.auth_token = $1`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        const user = result.rows[0];
        
        // التحقق من صلاحية التوكن
        if (!user.is_token_valid) {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    phone: user.phone,
                    token_expiry: user.token_expiry
                }
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            user: user
        });
        
    } catch (error) {
        console.error('❌ Error fetching user by token:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// روت التحقق من صلاحية التوكن وإرجاع معلومات محدودة (للاستخدام العام)
router.get('/check-token/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const pool = require('../db');
        
        const result = await pool.query(
            `SELECT 
                id,
                full_name,
                phone,
                token_expiry,
                CASE 
                    WHEN token_expiry > NOW() THEN true 
                    ELSE false 
                END as is_valid
            FROM users 
            WHERE auth_token = $1`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                valid: false,
                message: 'Token not found'
            });
        }
        
        const tokenData = result.rows[0];
        
        res.status(200).json({
            success: true,
            valid: tokenData.is_valid,
            message: tokenData.is_valid ? 'Token is valid' : 'Token has expired',
            user_id: tokenData.id,
            user_name: tokenData.full_name,
            user_phone: tokenData.phone,
            expiry_date: tokenData.token_expiry
        });
        
    } catch (error) {
        console.error('❌ Error checking token:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// روت تجديد التوكن بواسطة التوكن القديم (بدون معرفة ID)
router.post('/renew-token-by-old/:oldToken', async (req, res) => {
    const { oldToken } = req.params;
    
    try {
        const pool = require('../db');
        const crypto = require('crypto');
        
        // التحقق من وجود التوكن القديم
        const userResult = await pool.query(
            'SELECT id FROM users WHERE auth_token = $1',
            [oldToken]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        const userId = userResult.rows[0].id;
        
        // توليد توكن جديد وتاريخ انتهاء جديد
        const generateToken = () => {
            return crypto.randomBytes(32).toString('hex');
        };
        
        const getExpiryDate = () => {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            return expiryDate;
        };
        
        const newToken = generateToken();
        const newExpiry = getExpiryDate();
        
        // تحديث التوكن
        const result = await pool.query(
            `UPDATE users 
             SET auth_token = $1, token_expiry = $2
             WHERE id = $3
             RETURNING id, full_name, phone, auth_token, token_expiry`,
            [newToken, newExpiry, userId]
        );
        
        res.status(200).json({
            success: true,
            message: 'Token renewed successfully for one year',
            old_token: oldToken,
            new_token: result.rows[0].auth_token,
            expiry_date: result.rows[0].token_expiry,
            user: {
                id: result.rows[0].id,
                full_name: result.rows[0].full_name,
                phone: result.rows[0].phone
            }
        });
        
    } catch (error) {
        console.error('❌ Error renewing token by old token:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;