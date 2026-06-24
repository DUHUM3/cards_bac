const { Pool } = require('pg');
const pool = require('../db');

/**
 * إنشاء كرت جديد مع جميع الحقول المطلوبة
 * @route POST /api/cards/create
 * @body { 
 *   username, 
 *   password (اختياري), 
 *   category_id, 
 *   status, 
 *   owner_id (اختياري), 
 *   point_of_sale_id (اختياري),
 *   created_at (سيتم تعيينه تلقائياً)
 * }
 */
const createCard = async (req, res) => {
    const { 
        username, 
        password = null,  // اختياري
        category_id, 
        status = 'available',  // الحالة الافتراضية
        owner_id = null,  // اختياري
        point_of_sale_id = null  // اختياري
    } = req.body;

    // 1. التحقق من الحقول المطلوبة
    if (!username) {
        return res.status(400).json({
            success: false,
            message: 'Username is required',
            example: {
                username: "CARD_123456",
                password: "optional_password",
                category_id: 1,
                status: "available",
                owner_id: null,
                point_of_sale_id: null
            }
        });
    }

    if (!category_id) {
        return res.status(400).json({
            success: false,
            message: 'Category ID is required'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 2. التحقق من أن username غير موجود مسبقاً
        const existingCard = await client.query(
            `SELECT id, username FROM cards WHERE username = $1`,
            [username]
        );

        if (existingCard.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'Card username already exists',
                username: username
            });
        }

        // 3. التحقق من أن category_id موجود
        const categoryCheck = await client.query(
            `SELECT id, name FROM categories WHERE id = $1`,
            [category_id]
        );

        if (categoryCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Category not found',
                category_id: category_id
            });
        }

        // 4. التحقق من وجود owner_id إذا تم توفيره
        if (owner_id) {
            const ownerCheck = await client.query(
                `SELECT id, full_name FROM users WHERE id = $1`,
                [owner_id]
            );

            if (ownerCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Owner not found',
                    owner_id: owner_id
                });
            }
        }

        // 5. التحقق من وجود point_of_sale_id إذا تم توفيره
        if (point_of_sale_id) {
            const sellerCheck = await client.query(
                `SELECT id, full_name FROM users WHERE id = $1`,
                [point_of_sale_id]
            );

            if (sellerCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Seller not found',
                    point_of_sale_id: point_of_sale_id
                });
            }
        }

        // 6. التحقق من صحة حالة الكرت
        const validStatuses = ['available', 'private', 'sold', 'expired'];
        if (!validStatuses.includes(status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Allowed values: available, private, sold, expired',
                provided_status: status
            });
        }

        // 7. إنشاء الكرت الجديد
        const result = await client.query(
            `INSERT INTO cards (
                username,
                password,
                category_id,
                status,
                owner_id,
                point_of_sale_id,
                is_activated,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING 
                id,
                username,
                password,
                category_id,
                status,
                owner_id,
                point_of_sale_id,
                is_activated,
                created_at,
                updated_at`,
            [
                username,
                password,
                category_id,
                status,
                owner_id,
                point_of_sale_id,
                false  // is_activated = false بشكل افتراضي
            ]
        );

        const newCard = result.rows[0];

        // 8. تسجيل العملية (اختياري)
        // await client.query(
        //     `INSERT INTO card_creation_logs (
        //         card_id,
        //         username,
        //         category_id,
        //         created_by,
        //         metadata
        //     ) VALUES ($1, $2, $3, $4, $5)`,
        //     [
        //         newCard.id,
        //         username,
        //         category_id,
        //         req.user?.id || null,
        //         JSON.stringify({
        //             status: status,
        //             owner_id: owner_id,
        //             point_of_sale_id: point_of_sale_id,
        //             has_password: !!password,
        //             created_at: new Date().toISOString()
        //         })
        //     ]
        // );

        await client.query('COMMIT');

        // 9. إرجاع بيانات الكرت المُنشأ
        res.status(201).json({
            success: true,
            message: 'Card created successfully',
            data: {
                card: {
                    id: newCard.id,
                    username: newCard.username,
                    password: newCard.password,
                    category_id: newCard.category_id,
                    status: newCard.status,
                    owner_id: newCard.owner_id,
                    point_of_sale_id: newCard.point_of_sale_id,
                    is_activated: newCard.is_activated,
                    created_at: newCard.created_at,
                    updated_at: newCard.updated_at
                },
                category: categoryCheck.rows[0].name,
                created_by: req.user?.id || 'system'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating card:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating card',
            error: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * تفعيل كرت باستخدام username الكرت في الـ Body و token المستخدم في الـ Header
 * @route POST /api/cards/activate
 * @header Authorization: Bearer {token}
 * @body { username }  // username الكرت (من جدول cards)
 */
const activateCard = async (req, res) => {
    const { username } = req.body;  // يوزرنيم الكرت من البدي
    const token = req.headers.authorization?.split(' ')[1]; // تكن المستخدم من الهيدر

    // 1. التحقق من وجود التكن
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token is required in Authorization header'
        });
    }

    // 2. التحقق من وجود يوزرنيم الكرت
    if (!username) {
        return res.status(400).json({
            success: false,
            message: 'Card username is required in body',
            example: { username: "CARD_123456" }
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 3. البحث عن المستخدم باستخدام التكن (نحصل على ID فقط، لا يوجد username)
        const userResult = await client.query(
            `SELECT id, full_name, phone, user_type 
             FROM users 
             WHERE auth_token = $1 AND token_expiry > NOW()`,
            [token]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const user = userResult.rows[0]; // user.id فقط

        // 4. البحث عن الكرت باستخدام username (من جدول cards)
        const cardResult = await client.query(
            `SELECT c.*, cat.name as category_name, cat.selling_price
             FROM cards c
             LEFT JOIN categories cat ON c.category_id = cat.id
             WHERE c.username = $1`,  // username موجود في جدول cards
            [username]
        );

        if (cardResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Card not found',
                username: username
            });
        }

        const card = cardResult.rows[0];

        // 5. التحقق من حالة الكرت
        if (card.status !== 'available') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Card is not available. Current status: ${card.status}`,
                username: card.username
            });
        }

        // 6. التحقق من أن الكرت لم يتم تفعيله سابقاً
        if (card.is_activated) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Card has already been activated',
                activated_at: card.activated_at
            });
        }

        // 7. تحديث الكرت: تغيير الحالة، إضافة owner_id (من user.id)، تفعيل الكرت
        const updateResult = await client.query(
            `UPDATE cards 
             SET status = 'private',
                 owner_id = $1,
                 is_activated = true,
                 activated_at = NOW()
             WHERE username = $2
             RETURNING *`,
            [user.id, username]  // user.id من جدول users
        );

        const updatedCard = updateResult.rows[0];

        // 8. تسجيل العملية (اختياري)
        // await client.query(
        //     `INSERT INTO card_activation_logs (
        //         card_id,
        //         username,
        //         user_id,
        //         activation_method,
        //         metadata
        //     ) VALUES ($1, $2, $3, $4, $5)`,
        //     [
        //         updatedCard.id,
        //         username,
        //         user.id,
        //         'by_token',
        //         JSON.stringify({
        //             user_name: user.full_name,
        //             user_type: user.user_type,
        //             activated_at: new Date().toISOString()
        //         })
        //     ]
        // );

        await client.query('COMMIT');

        // 9. إرجاع بيانات الكرت بعد التفعيل
        res.status(200).json({
            success: true,
            message: 'Card activated successfully',
            data: {
                card: {
                    id: updatedCard.id,
                    username: updatedCard.username,
                    status: updatedCard.status,
                    is_activated: updatedCard.is_activated,
                    activated_at: updatedCard.activated_at,
                    category_name: card.category_name,
                    selling_price: card.selling_price
                },
                activated_by: {
                    id: user.id,
                    full_name: user.full_name,
                    phone: user.phone,
                    user_type: user.user_type
                }
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error activating card:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while activating card',
            error: error.message
        });
    } finally {
        client.release();
    }
};

module.exports = {
    createCard,
    activateCard,
    // ... باقي الدوال
};