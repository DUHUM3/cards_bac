const { Pool } = require('pg');
const pool = require('../db');

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

        // 8. تسجيل العملية
        // await client.query(
        //     `INSERT INTO transactions (
        //         user_id, card_id, operation_type, amount, status, description, metadata
        //     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        //     [
        //         user.id,
        //         updatedCard.id,
        //         'activate',
        //         updatedCard.selling_price || 0,
        //         'completed',
        //         `Card ${username} activated by user ID: ${user.id}`,
        //         JSON.stringify({
        //             username: username,
        //             user_id: user.id,
        //             activation_method: 'by_token_header'
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
    activateCard,
    // ... باقي الدوال
};