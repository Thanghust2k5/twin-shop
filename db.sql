-- 1. XÓA & TẠO DATABASE
DROP DATABASE IF EXISTS twin_shop;
CREATE DATABASE twin_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE twin_shop;

-- =======================================================
-- 2. TẠO CÁC BẢNG (SCHEMA)
-- =======================================================

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    -- [ĐÃ XÓA] Cột address (để quản lý bên user_addresses)
    phone VARCHAR(15) NULL,
    gender TINYINT DEFAULT 1,
    birthday DATE NULL,
    avatar TEXT NULL,
    role TINYINT DEFAULT 0, -- 0: Khách, 1: Admin
    wallet_balance DECIMAL(15, 0) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    is_default TINYINT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE shipping_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 0) DEFAULT 0
);

CREATE TABLE payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) -- COD, TWINPAY...
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 0) NOT NULL,
    stock INT DEFAULT 0, -- Tồn kho tổng
    discount_percentage INT DEFAULT 0,
    thumbnail VARCHAR(255),
    description TEXT,
    sold INT DEFAULT 0,
    rating DECIMAL(2, 1) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    stock INT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    color VARCHAR(50),
    size VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE orders (
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
);

CREATE TABLE order_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_at_time DECIMAL(10, 0) NOT NULL,
    color VARCHAR(50),
    size VARCHAR(20),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =======================================================
-- 4. INSERT DỮ LIỆU MẪU
-- =======================================================

INSERT INTO categories (name, description) VALUES 
('Biti\'s Hunter', 'Dòng cao cấp'), ('Biti\'s Sandal', 'Sandal học sinh'), ('Giày Tây', 'Sang trọng'), 
('Giày Trẻ Em', 'Cho bé'), ('Giày Chạy Bộ', 'Running'), ('Giày Đá Bóng', 'Football'), 
('Giày Vải', 'Street style'), ('Dép Lào', 'Thoải mái'), ('Phụ Kiện', 'Lót giày'), 
('Slip-on', 'Giày lười'), ('Giày Nữ', 'Thời trang nữ'), ('BST Tết', 'Limited');

-- [ĐÃ SỬA] Tạo User (Bỏ cột address ở đây)
INSERT INTO users (full_name, email, password, role, wallet_balance) VALUES 
('Admin Shop', 'admin@gmail.com', '$2a$10$Xk9...', 1, 0),
('Khách Test 1', 'khach1@gmail.com', '$2a$10$Xk9...', 0, 5000000), 
('Khách Test 2', 'khach2@gmail.com', '$2a$10$Xk9...', 0, 1000000);

-- [MỚI] Thêm địa chỉ mẫu vào bảng user_addresses (Thay thế cho cột address cũ)
INSERT INTO user_addresses (user_id, recipient_name, recipient_phone, address, is_default) VALUES 
(1, 'Admin Shop', '0901234567', 'Hà Nội', 1),
(2, 'Khách Test 1', '0901112222', 'Hồ Chí Minh', 1),
(3, 'Khách Test 2', '0903334444', 'Đà Nẵng', 1);

INSERT INTO shipping_methods (name, price) VALUES ('Nhanh', 30000), ('Hỏa tốc', 50000);
INSERT INTO payment_methods (name, code) VALUES ('Thanh toán khi nhận hàng', 'COD'), ('Ví T-WinPay', 'TWINPAY');

-- =======================================================
-- 5. LỆNH CẬP NHẬT TỒN KHO
-- =======================================================
UPDATE products p
SET stock = (
    SELECT IFNULL(SUM(stock), 0) 
    FROM product_variants pv 
    WHERE pv.product_id = p.id
);

UPDATE users SET wallet_balance = 5000000 WHERE id = 4;