const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ============================================================
// 1. CẤU HÌNH (SMART CONFIG)
// ============================================================
const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'twin_shop', // Tên DB
    port: process.env.DB_PORT || 3306,
    ssl: (process.env.DB_HOST || '').includes('aivencloud') ? { rejectUnauthorized: false } : undefined
};

const NUM_PRODUCTS = 1000;

// ============================================================
// 2. SCHEMA (CẤU TRÚC BẢNG)
// ============================================================
const tables = [
    `CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(15) NULL,
        gender TINYINT DEFAULT 1,
        birthday DATE NULL,
        avatar TEXT NULL,
        role TINYINT DEFAULT 0,
        wallet_balance DECIMAL(15, 0) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        recipient_name VARCHAR(100) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        is_default TINYINT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS shipping_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 0) DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50)
    )`,
    `CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 0) NOT NULL,
        stock INT DEFAULT 0,
        discount_percentage INT DEFAULT 0,
        thumbnail VARCHAR(255),
        description TEXT,
        sold INT DEFAULT 0,
        rating DECIMAL(2, 1) DEFAULT 5.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        color VARCHAR(50) NOT NULL,
        size VARCHAR(20) NOT NULL,
        stock INT DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT DEFAULT 1,
        color VARCHAR(50),
        size VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        shipping_id INT,
        payment_id INT, 
        recipient_name VARCHAR(100) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        recipient_address TEXT NOT NULL,
        note TEXT,
        total_money DECIMAL(12, 0) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'COD',
        status ENUM('pending', 'shipping', 'completed', 'cancelled') DEFAULT 'pending',
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (shipping_id) REFERENCES shipping_methods(id),
        FOREIGN KEY (payment_id) REFERENCES payment_methods(id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price_at_time DECIMAL(10, 0) NOT NULL,
        color VARCHAR(50),
        size VARCHAR(20),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`
];

// ============================================================
// 3. LOGIC CHẠY (MAIN)
// ============================================================
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function runSeed() {
    let connection;
    try {
        console.log("🚀 Bắt đầu khởi tạo hệ thống...");

        // --- BƯỚC 0: TẠO DATABASE (Logic an toàn) ---
        // Chúng ta thử kết nối mà KHÔNG có tên database.
        // Nếu là Localhost: Nó sẽ kết nối được -> Tạo Database.
        // Nếu là Aiven: Nó có thể lỗi (vì Aiven bắt connect đúng DB) -> Bỏ qua bước này.
        try {
            const { database, ...initParams } = config; // Tách tên DB ra
            const tempConn = await mysql.createConnection(initParams);
            
            // [ĐÂY LÀ DÒNG BẠN TÌM KIẾM]
            await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`✅ Đã kiểm tra/tạo Database: ${config.database}`);
            
            await tempConn.end();
        } catch (err) {
            // Nếu lỗi ở bước này, thường là do đang ở trên Cloud (Aiven) 
            // và Cloud không cho connect "khơi khơi" mà bắt connect thẳng vào DB có sẵn.
            // Nên ta cứ lờ đi và chạy tiếp.
            console.log("ℹ️  Đang chạy trên môi trường có sẵn Database (hoặc Cloud). Bỏ qua bước tạo DB.");
        }

        // --- BƯỚC 1: KẾT NỐI CHÍNH THỨC ---
        connection = await mysql.createConnection(config);
        console.log(`🔌 Đã kết nối vào: ${config.database}`);

        // --- BƯỚC 2: XÓA DỮ LIỆU CŨ (DROP) ---
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        const tableNames = ['reviews', 'order_details', 'orders', 'cart_items', 'product_images', 'product_variants', 'products', 'payment_methods', 'shipping_methods', 'user_addresses', 'users', 'categories'];
        for (const tbl of tableNames) {
            await connection.query(`DROP TABLE IF EXISTS ${tbl}`);
        }
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("🗑️  Đã dọn dẹp dữ liệu cũ.");

        // --- BƯỚC 3: TẠO BẢNG MỚI ---
        for (const sql of tables) {
            await connection.query(sql);
        }
        console.log("🏗️  Đã tạo xong cấu trúc bảng.");

        // --- BƯỚC 4: INSERT DỮ LIỆU ---
        
        // 4.1. Categories
        const cats = [
            "Biti's Hunter", "Biti's Sandal", "Giày Tây", "Giày Trẻ Em", 
            "Giày Chạy Bộ", "Giày Đá Bóng", "Giày Vải", "Dép Lào", 
            "Phụ Kiện", "Slip-on", "Giày Nữ", "BST Tết"
        ];
        for (const c of cats) {
            await connection.query('INSERT INTO categories (name, description) VALUES (?, ?)', [c, `Mô tả cho ${c}`]);
        }
        console.log("📂 Đã tạo Danh mục.");

        // 4.2. Users & Addresses
        const salt = bcrypt.genSaltSync(10);
        const passHash = bcrypt.hashSync("123456", salt); 

        await connection.query(`INSERT INTO users (id, full_name, email, password, role, wallet_balance) VALUES 
            (1, 'Admin Shop', 'admin@gmail.com', ?, 1, 0),
            (2, 'Khách Test 1', 'khach1@gmail.com', ?, 0, 5000000), 
            (3, 'Khách Test 2', 'khach2@gmail.com', ?, 0, 1000000)`, [passHash, passHash, passHash]);
        
        await connection.query(`INSERT INTO user_addresses (user_id, recipient_name, recipient_phone, address, is_default) VALUES 
            (1, 'Admin Shop', '0901234567', 'Hà Nội', 1),
            (2, 'Khách Test 1', '0901112222', 'Hồ Chí Minh', 1),
            (3, 'Khách Test 2', '0903334444', 'Đà Nẵng', 1)`);
        console.log("👤 Đã tạo User & Địa chỉ.");

        // 4.3. Shipping & Payment
        await connection.query(`INSERT INTO shipping_methods (name, price) VALUES ('Nhanh', 30000), ('Hỏa tốc', 50000)`);
        await connection.query(`INSERT INTO payment_methods (name, code) VALUES ('Thanh toán khi nhận hàng', 'COD'), ('Ví T-WinPay', 'TWINPAY')`);

        // 4.4. Products (Random)
        console.log(`📦 Đang tạo ${NUM_PRODUCTS} sản phẩm ngẫu nhiên...`);
        const brands = ["Nike", "Adidas", "Puma", "Biti's", "Vans", "Converse", "New Balance"];
        const adjs = ["Siêu Nhẹ", "Chống Nước", "Thoáng Khí", "Cao Cấp", "Bản Giới Hạn", "Mới Nhất"];
        
        const [catRows] = await connection.query("SELECT id FROM categories");
        const catIds = catRows.map(r => r.id);

        for (let i = 1; i <= NUM_PRODUCTS; i++) {
            const catId = randomItem(catIds);
            const brand = randomItem(brands);
            const name = `${brand} ${randomItem(adjs)} - Mã ${i}`;
            const price = randomInt(2, 50) * 100000;
            const imgId = randomInt(1, 10);
            
            const [res] = await connection.query(
                `INSERT INTO products (name, price, category_id, thumbnail, description, stock, discount_percentage, sold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, price, catId, `/assets/img/products/sp${imgId}.jpg`, `Mô tả chi tiết cho ${name}.`, 0, randomInt(0, 50), randomInt(0, 1000)]
            );
            const pId = res.insertId;

            const variants = [['Đen', '40'], ['Đen', '41'], ['Trắng', '40'], ['Trắng', '41']];
            let totalStock = 0;
            for(let v of variants) {
                const stock = randomInt(10, 100);
                totalStock += stock;
                await connection.query(`INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)`, [pId, v[0], v[1], stock]);
            }

            await connection.query(`UPDATE products SET stock = ? WHERE id = ?`, [totalStock, pId]);
            await connection.query(`INSERT INTO product_images (product_id, image_url) VALUES (?, ?)`, [pId, `/assets/img/products/sp${imgId}.jpg`]);
        }

        console.log("✨ XONG! Hệ thống đã sẵn sàng.");
        console.log("👉 Admin: admin@gmail.com | Pass: 123456");

    } catch (err) {
        console.error("❌ LỖI:", err);
    } finally {
        if (connection) await connection.end();
    }
}

runSeed();