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

  // جلب محفظة بالـ ID
  getWalletById: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `SELECT w.*, u.full_name, u.username, u.phone 
         FROM wallets w
         JOIN users u ON w.user_id = u.id
         WHERE w.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة'
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

  // تحديث الرصيد بالكامل (استبدال الرصيد)
  updateWalletBalance: async (req, res) => {
    const { id } = req.params;
    const { balance } = req.body;

    // التحقق من وجود balance
    if (balance === undefined) {
      return res.status(400).json({
        success: false,
        message: 'الحقل balance مطلوب'
      });
    }

    // التحقق من أن الرصيد ليس سالباً
    if (balance < 0) {
      return res.status(400).json({
        success: false,
        message: 'الرصيد لا يمكن أن يكون سالباً'
      });
    }

    try {
      // التحقق من وجود المحفظة
      const walletCheck = await pool.query(
        'SELECT * FROM wallets WHERE id = $1',
        [id]
      );

      if (walletCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة'
        });
      }

      // تحديث الرصيد
      const result = await pool.query(
        `UPDATE wallets 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [balance, id]
      );

      res.status(200).json({
        success: true,
        message: 'تم تحديث الرصيد بنجاح',
        old_balance: walletCheck.rows[0].balance,
        new_balance: result.rows[0].balance,
        wallet: result.rows[0]
      });

    } catch (error) {
      console.error('❌ خطأ في تحديث الرصيد:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    }
  },

  // إضافة رصيد (شحن المحفظة)
  addBalance: async (req, res) => {
    const { id } = req.params;
    const { amount, description = 'إضافة رصيد' } = req.body;

    // التحقق من وجود المبلغ
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'الحقل amount مطلوب'
      });
    }

    // التحقق من أن المبلغ موجب
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن يكون المبلغ أكبر من صفر'
      });
    }

    try {
      // التحقق من وجود المحفظة
      const walletCheck = await pool.query(
        'SELECT * FROM wallets WHERE id = $1',
        [id]
      );

      if (walletCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة'
        });
      }

      const oldBalance = parseFloat(walletCheck.rows[0].balance);
      const newBalance = oldBalance + parseFloat(amount);

      // تحديث الرصيد
      const result = await pool.query(
        `UPDATE wallets 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [newBalance, id]
      );

      // تسجيل المعاملة (اختياري - إذا كان عندك جدول transactions)
      // await pool.query(
      //   `INSERT INTO transactions (wallet_id, type, amount, old_balance, new_balance, description)
      //    VALUES ($1, $2, $3, $4, $5, $6)`,
      //   [id, 'credit', amount, oldBalance, newBalance, description]
      // );

      res.status(200).json({
        success: true,
        message: 'تم إضافة الرصيد بنجاح',
        added_amount: parseFloat(amount),
        old_balance: oldBalance,
        new_balance: newBalance,
        wallet: result.rows[0]
      });

    } catch (error) {
      console.error('❌ خطأ في إضافة الرصيد:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    }
  },

  // سحب رصيد (خصم من المحفظة)
  deductBalance: async (req, res) => {
    const { id } = req.params;
    const { amount, description = 'سحب رصيد' } = req.body;

    // التحقق من وجود المبلغ
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'الحقل amount مطلوب'
      });
    }

    // التحقق من أن المبلغ موجب
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن يكون المبلغ أكبر من صفر'
      });
    }

    try {
      // التحقق من وجود المحفظة
      const walletCheck = await pool.query(
        'SELECT * FROM wallets WHERE id = $1',
        [id]
      );

      if (walletCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة'
        });
      }

      const oldBalance = parseFloat(walletCheck.rows[0].balance);
      
      // التحقق من وجود رصيد كافي
      if (oldBalance < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          message: 'الرصيد غير كافي',
          current_balance: oldBalance,
          required_amount: parseFloat(amount)
        });
      }

      const newBalance = oldBalance - parseFloat(amount);

      // تحديث الرصيد
      const result = await pool.query(
        `UPDATE wallets 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [newBalance, id]
      );

      // تسجيل المعاملة (اختياري - إذا كان عندك جدول transactions)
      // await pool.query(
      //   `INSERT INTO transactions (wallet_id, type, amount, old_balance, new_balance, description)
      //    VALUES ($1, $2, $3, $4, $5, $6)`,
      //   [id, 'debit', amount, oldBalance, newBalance, description]
      // );

      res.status(200).json({
        success: true,
        message: 'تم سحب الرصيد بنجاح',
        deducted_amount: parseFloat(amount),
        old_balance: oldBalance,
        new_balance: newBalance,
        wallet: result.rows[0]
      });

    } catch (error) {
      console.error('❌ خطأ في سحب الرصيد:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    }
  },

  // حذف محفظة
  deleteWallet: async (req, res) => {
    const { id } = req.params;

    try {
      // التحقق من وجود المحفظة
      const walletCheck = await pool.query(
        'SELECT * FROM wallets WHERE id = $1',
        [id]
      );

      if (walletCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المحفظة غير موجودة'
        });
      }

      // حذف المحفظة
      await pool.query('DELETE FROM wallets WHERE id = $1', [id]);

      res.status(200).json({
        success: true,
        message: 'تم حذف المحفظة بنجاح',
        deleted_wallet: walletCheck.rows[0]
      });

    } catch (error) {
      console.error('❌ خطأ في حذف المحفظة:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    }
  },

  // تحويل رصيد بين محفظتين
  transferBalance: async (req, res) => {
    const { from_wallet_id, to_wallet_id, amount, description = 'تحويل رصيد' } = req.body;

    // التحقق من وجود البيانات المطلوبة
    if (!from_wallet_id || !to_wallet_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'الحقول المطلوبة: from_wallet_id, to_wallet_id, amount'
      });
    }

    // التحقق من أن المبلغ موجب
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن يكون المبلغ أكبر من صفر'
      });
    }

    // التحقق من أن المحفظتين مختلفتين
    if (from_wallet_id === to_wallet_id) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن التحويل لنفس المحفظة'
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN'); // بدء المعاملة

      // التحقق من وجود المحفظة المرسلة
      const fromWallet = await client.query(
        'SELECT * FROM wallets WHERE id = $1 FOR UPDATE',
        [from_wallet_id]
      );

      if (fromWallet.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'المحفظة المرسلة غير موجودة'
        });
      }

      // التحقق من وجود المحفظة المستقبلة
      const toWallet = await client.query(
        'SELECT * FROM wallets WHERE id = $1 FOR UPDATE',
        [to_wallet_id]
      );

      if (toWallet.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'المحفظة المستقبلة غير موجودة'
        });
      }

      const fromBalance = parseFloat(fromWallet.rows[0].balance);
      
      // التحقق من وجود رصيد كافي
      if (fromBalance < parseFloat(amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'الرصيد غير كافي للتحويل',
          current_balance: fromBalance,
          required_amount: parseFloat(amount)
        });
      }

      const newFromBalance = fromBalance - parseFloat(amount);
      const newToBalance = parseFloat(toWallet.rows[0].balance) + parseFloat(amount);

      // تحديث رصيد المحفظة المرسلة
      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newFromBalance, from_wallet_id]
      );

      // تحديث رصيد المحفظة المستقبلة
      await client.query(
        'UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newToBalance, to_wallet_id]
      );

      await client.query('COMMIT'); // تأكيد المعاملة

      res.status(200).json({
        success: true,
        message: 'تم التحويل بنجاح',
        transfer: {
          from_wallet: from_wallet_id,
          to_wallet: to_wallet_id,
          amount: parseFloat(amount),
          from_wallet_new_balance: newFromBalance,
          to_wallet_new_balance: newToBalance
        }
      });

    } catch (error) {
      await client.query('ROLLBACK'); // التراجع في حالة الخطأ
      console.error('❌ خطأ في تحويل الرصيد:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم',
        error: error.message
      });
    } finally {
      client.release(); // تحرير الاتصال
    }
  }
};

module.exports = walletController;