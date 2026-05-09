const pool = require('../db');

const walletController = {
  // إنشاء محفظة لمستخدم موجود
  createWallet: async (req, res) => {
    const { user_id, initial_balance = 0.00 } = req.body;

    // التحقق من وجود user_id
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'الحقل user_id مطلوب'
      });
    }

    // التحقق من أن الرصيد ليس سالباً
    if (initial_balance < 0) {
      return res.status(400).json({
        success: false,
        message: 'الرصيد الابتدائي لا يمكن أن يكون سالباً'
      });
    }

    try {
      // التحقق من وجود المستخدم
      const userCheck = await pool.query(
        'SELECT id, full_name, username FROM users WHERE id = $1',
        [user_id]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      // إنشاء المحفظة
      const result = await pool.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, $2)
         RETURNING *`,
        [user_id, initial_balance]
      );

      res.status(201).json({
        success: true,
        message: 'تم إنشاء المحفظة بنجاح',
        wallet: result.rows[0],
        user: {
          id: userCheck.rows[0].id,
          full_name: userCheck.rows[0].full_name,
          username: userCheck.rows[0].username
        }
      });

    } catch (error) {
      console.error('❌ خطأ في إنشاء المحفظة:', error);

      // التحقق من وجود محفظة مسبقاً للمستخدم
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'هذا المستخدم لديه محفظة بالفعل'
        });
      }

      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    }
  },

  // جلب محفظة مستخدم
  getWalletByUserId: async (req, res) => {
    const { user_id } = req.params;

    try {
      const result = await pool.query(
        `SELECT w.*, u.full_name, u.username, u.phone 
         FROM wallets w
         JOIN users u ON w.user_id = u.id
         WHERE w.user_id = $1`,
        [user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة لهذا المستخدم'
        });
      }

      res.json({
        success: true,
        wallet: result.rows[0]
      });

    } catch (error) {
      console.error('❌ خطأ:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم'
      });
    }
  },

  // يمكنك إضافة دوال أخرى هنا
  // updateWallet: async (req, res) => { ... },
  // deleteWallet: async (req, res) => { ... },
  // transferBalance: async (req, res) => { ... }
};

module.exports = walletController;