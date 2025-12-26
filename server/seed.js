// seed.js
const mysql = require('mysql2/promise');

// CẤU HÌNH KẾT NỐI (Sửa lại pass nếu cần)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Mật khẩu XAMPP thường để trống
    database: 'twin_shop'
};

const NUM_PRODUCTS = 400; // Số lượng muốn tạo

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
    console.log("🚀 Đang kết nối Database...");
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log("🗑️  Đang dọn dẹp dữ liệu cũ...");
        // Xóa dữ liệu cũ để tránh trùng lặp (Tùy chọn)
        await connection.query('DELETE FROM products'); 
        // Lưu ý: Do có khóa ngoại (Foreign Key) DELETE CASCADE, 
        // nên xóa products là nó tự xóa luôn variants và images.

        console.log(`🌱 Đang tạo ${NUM_PRODUCTS} sản phẩm...`);

        // Dữ liệu mẫu để random
        const brands = ["Biti's", "Nike", "Adidas", "Puma", "New Balance", "Vans"];
        const types = ["Hunter", "Running", "Sneaker", "Sandal", "Slip-on"];
        const adjectives = ["Cao Cấp", "Siêu Nhẹ", "Thoáng Khí", "Bền Bỉ", "Thời Trang"];

        for (let i = 1; i <= NUM_PRODUCTS; i++) {
            // 1. Random thông tin
            const catId = randomInt(1, 12);
            const price = randomInt(100, 2000) * 1000; // Giá từ 100k -> 2tr
            const sold = randomInt(0, 5000);
            const discount = randomInt(0, 50);
            const imgId = randomInt(1, 15);
            
            // Tạo tên ngẫu nhiên cho đỡ chán
            const name = `${randomItem(brands)} ${randomItem(types)} ${randomItem(adjectives)} #${i}`;
            const desc = `Mô tả sản phẩm ${name}.\n✅ Bảo hành 12 tháng.\n✅ Fullbox, tag, giấy gói.`;

            // 2. Insert Sản phẩm
            const [res] = await connection.query(
                `INSERT INTO products (name, price, category_id, thumbnail, discount_percentage, sold, description) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, price, catId, `./assets/img/products/sp${imgId}-main.jpg`, discount, sold, desc]
            );

            const productId = res.insertId; // Lấy ID vừa tạo

            // 3. Insert 4 Biến thể (Màu/Size)
            const variants = [
                ['Đen', '39'], ['Đen', '40'], 
                ['Trắng', '39'], ['Trắng', '40']
            ];

            for (let v of variants) {
                await connection.query(
                    `INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)`,
                    [productId, v[0], v[1], 50] // Mặc định stock 50
                );
            }

            // 4. Insert Ảnh phụ
            await connection.query(
                `INSERT INTO product_images (product_id, image_url) VALUES (?, ?)`,
                [productId, `./assets/img/products/sp${imgId}-sub1.jpg`]
            );

            // Log tiến độ mỗi 50 sản phẩm
            if (i % 50 === 0) console.log(`   ...Đã tạo ${i}/${NUM_PRODUCTS} sản phẩm`);
        }

        console.log("✅ HOÀN TẤT! Đã tạo xong dữ liệu.");

    } catch (error) {
        console.error("❌ Lỗi:", error);
    } finally {
        await connection.end();
    }
}

seed();