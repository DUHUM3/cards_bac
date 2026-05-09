const pool = require('../db');

const userController = {
  // إنشاء مستخدم جديد
  createUser: async (req, res) => {
    const {
      full_name,
      phone,
      region,
      user_type = 'normal',
      settings = {}
    } = req.body;

    // Validate required fields
    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: full_name, phone'
      });
    }

    try {
      // Insert new user
      const result = await pool.query(
        `INSERT INTO users
        (full_name, phone, region, user_type, settings)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          full_name,
          phone,
          region,
          user_type,
          settings
        ]
      );

      const newUser = result.rows[0];

      // Create wallet automatically
      const walletResult = await pool.query(
        `INSERT INTO wallets (user_id, balance)
         VALUES ($1, $2)
         RETURNING *`,
        [newUser.id, 0.00]
      );

      res.status(201).json({
        success: true,
        message: 'User and wallet created successfully',
        user: newUser,
        wallet: walletResult.rows[0]
      });

    } catch (error) {
      console.error('❌ Error creating user:', error);

      // Duplicate phone number
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Phone number already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  },

  // جلب جميع المستخدمين (بدون created_at و updated_at)
  getAllUsers: async (req, res) => {
    try {
      // جلب جميع المستخدمين مع معلومات محافظهم
      const result = await pool.query(
        `SELECT 
          u.id,
          u.full_name,
          u.phone,
          u.region,
          u.user_type,
          u.settings,
          COALESCE(w.balance, 0) as wallet_balance,
          w.id as wallet_id
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.id DESC`
      );

      res.status(200).json({
        success: true,
        count: result.rows.length,
        users: result.rows
      });

    } catch (error) {
      console.error('❌ Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  },

  // جلب مستخدم محدد بال ID (بدون created_at و updated_at)
  getUserById: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `SELECT 
          u.id,
          u.full_name,
          u.phone,
          u.region,
          u.user_type,
          u.settings,
          COALESCE(w.balance, 0) as wallet_balance,
          w.id as wallet_id
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        user: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Error fetching user:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  },

  // تحديث بيانات مستخدم (بدون updated_at)
  updateUser: async (req, res) => {
    const { id } = req.params;
    const {
      full_name,
      phone,
      region,
      user_type,
      settings
    } = req.body;

    // التحقق من وجود ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    try {
      // التحقق من وجود المستخدم
      const userExists = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (userExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // بناء استعلام التحديث ديناميكياً
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (full_name !== undefined) {
        updates.push(`full_name = $${paramIndex++}`);
        values.push(full_name);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (region !== undefined) {
        updates.push(`region = $${paramIndex++}`);
        values.push(region);
      }
      if (user_type !== undefined) {
        updates.push(`user_type = $${paramIndex++}`);
        values.push(user_type);
      }
      if (settings !== undefined) {
        updates.push(`settings = $${paramIndex++}`);
        values.push(settings);
      }

      // إذا لم يتم إرسال أي بيانات للتحديث
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // إضافة ID كآخر قيمة
      values.push(id);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        user: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Error updating user:', error);

      // Duplicate phone number
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Phone number already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  },

  // حذف مستخدم
  deleteUser: async (req, res) => {
    const { id } = req.params;

    try {
      // التحقق من وجود المستخدم
      const userExists = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (userExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // حذف المحفظة أولاً (بسببForeignKey)
      await pool.query('DELETE FROM wallets WHERE user_id = $1', [id]);
      
      // ثم حذف المستخدم
      await pool.query('DELETE FROM users WHERE id = $1', [id]);

      res.status(200).json({
        success: true,
        message: 'User and associated wallet deleted successfully'
      });

    } catch (error) {
      console.error('❌ Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  },

  // البحث عن مستخدمين
  searchUsers: async (req, res) => {
    const { search, user_type, region } = req.query;
    
    try {
      let query = `
        SELECT 
          u.id,
          u.full_name,
          u.phone,
          u.region,
          u.user_type,
          u.settings,
          COALESCE(w.balance, 0) as wallet_balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE 1=1
      `;
      
      const values = [];
      let paramIndex = 1;
      
      if (search) {
        query += ` AND (u.full_name ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }
      
      if (user_type) {
        query += ` AND u.user_type = $${paramIndex}`;
        values.push(user_type);
        paramIndex++;
      }
      
      if (region) {
        query += ` AND u.region ILIKE $${paramIndex}`;
        values.push(`%${region}%`);
        paramIndex++;
      }
      
      query += ` ORDER BY u.id DESC`;
      
      const result = await pool.query(query, values);
      
      res.status(200).json({
        success: true,
        count: result.rows.length,
        users: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error searching users:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }
};

module.exports = userController;