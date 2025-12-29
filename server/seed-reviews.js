const mysql = require('mysql2/promise');

// ============================================================
// CẤU HÌNH KẾT NỐI
// ============================================================
const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'twin_shop',
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST || '').includes('aivencloud') ? { rejectUnauthorized: false } : undefined
};

// ============================================================
// CẤU HÌNH SEED REVIEWS
// ============================================================
const REVIEWS_PER_PRODUCT_MIN = 3;   // Số review tối thiểu mỗi sản phẩm
const REVIEWS_PER_PRODUCT_MAX = 15;  // Số review tối đa mỗi sản phẩm

// Mảng comment mẫu theo số sao
const reviewComments = {
    5: [
        "Sản phẩm tuyệt vời, đúng như mô tả!",
        "Giao hàng nhanh, đóng gói cẩn thận. Rất hài lòng!",
        "Chất lượng xuất sắc, đáng đồng tiền bát gạo",
        "Mình rất thích, sẽ ủng hộ shop dài dài",
        "10 điểm không có nhưng, quá đẹp!",
        "Đẹp lắm, mang rất êm chân",
        "Chất lượng tốt, giá cả hợp lý",
        "Shop giao hàng siêu nhanh, sản phẩm đẹp",
        "Rất ưng ý, sẽ giới thiệu bạn bè mua",
        "Sản phẩm chính hãng, đáng tin cậy"
    ],
    4: [
        "Sản phẩm tốt, nhưng giao hàng hơi lâu",
        "Đẹp, chất lượng ổn, giá hợp lý",
        "Mang êm chân, thiết kế đẹp",
        "Hài lòng với sản phẩm, sẽ quay lại",
        "Chất lượng tốt so với giá tiền",
        "Sản phẩm đúng mô tả, đóng gói cẩn thận",
        "Mua lần 2 rồi, vẫn rất ưng ý",
        "Đẹp lắm, chỉ là size hơi chật một xíu"
    ],
    3: [
        "Sản phẩm tạm ổn, không có gì đặc biệt",
        "Chất lượng trung bình, giá hơi cao",
        "Giao hàng chậm, sản phẩm bình thường",
        "Mang được nhưng không êm lắm",
        "Đúng hình nhưng màu hơi khác một chút",
        "Tạm được, cần cải thiện chất lượng"
    ],
    2: [
        "Sản phẩm không như kỳ vọng",
        "Chất lượng kém hơn mô tả",
        "Giao hàng chậm, đóng gói sơ sài",
        "Mang không được êm, hơi thất vọng",
        "Size không chuẩn, phải đổi lại"
    ],
    1: [
        "Sản phẩm kém chất lượng, không đáng tiền",
        "Rất thất vọng, không như mô tả",
        "Hàng lỗi, shop không hỗ trợ đổi trả",
        "Giao hàng quá lâu, sản phẩm hỏng",
        "Không recommend, chất lượng tệ"
    ]
};

// ============================================================
// HÀM TIỆN ÍCH
// ============================================================
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Random số sao với trọng số (thiên về 4-5 sao)
function randomRating() {
    const weights = [5, 10, 15, 35, 35]; // 1★=5%, 2★=10%, 3★=15%, 4★=35%, 5★=35%
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) return i + 1;
    }
    return 5;
}

// Random ngày trong khoảng 6 tháng gần đây
function randomDate() {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const randomTime = sixMonthsAgo.getTime() + Math.random() * (now.getTime() - sixMonthsAgo.getTime());
    return new Date(randomTime).toISOString().slice(0, 19).replace('T', ' ');
}

// ============================================================
// HÀM CHÍNH
// ============================================================
async function seedReviews() {
    let connection;
    try {
        console.log("🚀 Bắt đầu tạo đánh giá...");
        connection = await mysql.createConnection(config);
        console.log(`🔌 Đã kết nối vào: ${config.database}`);

        // Lấy danh sách sản phẩm
        const [products] = await connection.query("SELECT id FROM products");
        console.log(`📦 Tìm thấy ${products.length} sản phẩm`);

        // Lấy danh sách user (để random user_id)
        const [users] = await connection.query("SELECT id FROM users WHERE role = 0");
        if (users.length === 0) {
            console.log("⚠️  Không có user nào! Đang tạo thêm user test...");
            // Tạo thêm user test nếu chưa có
            for (let i = 1; i <= 10; i++) {
                await connection.query(
                    "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 0)",
                    [`User Test ${i}`, `usertest${i}@gmail.com`, '$2a$10$abcdefghijklmnopqrstuvwxyz123456']
                );
            }
            const [newUsers] = await connection.query("SELECT id FROM users WHERE role = 0");
            users.push(...newUsers);
        }
        const userIds = users.map(u => u.id);
        console.log(`👤 Có ${userIds.length} user để random`);

        // Xóa reviews cũ (nếu muốn làm mới)
        await connection.query("DELETE FROM reviews");
        console.log("🗑️  Đã xóa reviews cũ");

        // Tạo reviews cho từng sản phẩm
        let totalReviews = 0;
        const batchSize = 100; // Insert theo batch để nhanh hơn
        let reviewBatch = [];

        for (let i = 0; i < products.length; i++) {
            const productId = products[i].id;
            const numReviews = randomInt(REVIEWS_PER_PRODUCT_MIN, REVIEWS_PER_PRODUCT_MAX);

            for (let j = 0; j < numReviews; j++) {
                const rating = randomRating();
                const comment = randomItem(reviewComments[rating]);
                const userId = randomItem(userIds);
                const createdAt = randomDate();

                reviewBatch.push([userId, productId, rating, comment, createdAt]);
                totalReviews++;
            }

            // Insert batch khi đủ số lượng hoặc là sản phẩm cuối
            if (reviewBatch.length >= batchSize || i === products.length - 1) {
                await connection.query(
                    "INSERT INTO reviews (user_id, product_id, rating, comment, created_at) VALUES ?",
                    [reviewBatch]
                );
                reviewBatch = [];
                
                // Hiển thị tiến độ
                const progress = Math.round((i + 1) / products.length * 100);
                process.stdout.write(`\r⏳ Đang xử lý: ${progress}% (${i + 1}/${products.length} sản phẩm)`);
            }
        }

        console.log(`\n✅ Đã tạo ${totalReviews} đánh giá cho ${products.length} sản phẩm`);

        // Cập nhật rating trung bình cho tất cả sản phẩm
        console.log("📊 Đang tính rating trung bình...");
        await connection.query(`
            UPDATE products p 
            SET rating = (
                SELECT ROUND(AVG(r.rating), 1) 
                FROM reviews r 
                WHERE r.product_id = p.id
            )
            WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = p.id)
        `);

        // Thống kê kết quả
        const [stats] = await connection.query(`
            SELECT 
                rating,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM reviews), 1) as percentage
            FROM reviews 
            GROUP BY rating 
            ORDER BY rating DESC
        `);

        console.log("\n📈 THỐNG KÊ ĐÁNH GIÁ:");
        console.log("─".repeat(40));
        stats.forEach(s => {
            const stars = "★".repeat(s.rating) + "☆".repeat(5 - s.rating);
            const bar = "█".repeat(Math.round(s.percentage / 5));
            console.log(`${stars} | ${s.count.toString().padStart(5)} reviews (${s.percentage}%) ${bar}`);
        });
        console.log("─".repeat(40));

        const [avgResult] = await connection.query("SELECT ROUND(AVG(rating), 2) as avg FROM reviews");
        console.log(`⭐ Rating trung bình toàn hệ thống: ${avgResult[0].avg}`);

        console.log("\n✨ HOÀN TẤT!");

    } catch (err) {
        console.error("\n❌ LỖI:", err);
    } finally {
        if (connection) await connection.end();
    }
}

seedReviews();
