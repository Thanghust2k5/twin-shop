/* =========================================================
   TWIN SHOP - SERVER.JS
   =========================================================
   
   Đây là file BACKEND CHÍNH của website, chạy bằng Node.js
   
   CHỨC NĂNG:
   1. API Server (RESTful API)
      - Xử lý đăng ký/đăng nhập user
      - CRUD sản phẩm, đơn hàng, user...
      - Upload ảnh sản phẩm/avatar
   
   2. Static File Server
      - Serve các file HTML, CSS, JS, images
   
   3. Realtime Chat (Socket.io)
      - Chat giữa khách hàng và admin
   
   CÁC THƯ VIỆN SỬ DỤNG:
   - express    : Framework web phổ biến nhất cho Node.js
   - mysql2     : Kết nối database MySQL
   - cors       : Cho phép cross-origin requests
   - multer     : Xử lý upload file
   - bcryptjs   : Mã hóa password
   - socket.io  : Realtime communication
   
   ========================================================= */

// ==========================================
// IMPORT THƯ VIỆN
// ==========================================

// Express - Framework xây dựng web server
const express = require("express");

// MySQL2 - Driver kết nối MySQL database
const mysql = require("mysql2");

// CORS - Cho phép frontend gọi API từ domain khác
const cors = require("cors");

// Multer - Middleware xử lý upload file (multipart/form-data)
const multer = require("multer");

// Path - Xử lý đường dẫn file (Node.js built-in)
const path = require("path");

// FS - File System, đọc/ghi file (Node.js built-in)
const fs = require("fs");

// Bcrypt - Mã hóa password (hash + salt)
const bcrypt = require("bcryptjs");

// HTTP - Tạo HTTP server (Node.js built-in)
const http = require("http");

// Socket.io - Thư viện realtime communication
const { Server } = require("socket.io");

// ==========================================
// KHỞI TẠO APP VÀ SERVER
// ==========================================

// Tạo Express app
const app = express();

// Tạo HTTP server từ Express app
// (Cần thiết để Socket.io hoạt động)
const server = http.createServer(app);

// Tạo Socket.io server gắn vào HTTP server
const io = new Server(server, {
    cors: {
        origin: "*",           // Cho phép mọi domain kết nối
        methods: ["GET", "POST"]
    }
});

// Port server sẽ chạy (lấy từ env hoặc mặc định 3000)
const port = process.env.PORT || 3000;

// ==========================================
// 1. CẤU HÌNH MIDDLEWARE
// ==========================================

// Cho phép CORS (Cross-Origin Resource Sharing)
// Để frontend ở domain khác có thể gọi API
app.use(cors());

// Parse JSON body (cho POST/PUT requests)
app.use(express.json());

// Parse URL-encoded body (cho form submissions)
app.use(express.urlencoded({
    extended: true
}));

// Serve Static Files (HTML, CSS, JS, images...)
// Tất cả file trong thư mục cha của server/ sẽ được serve
app.use(express.static(path.join(__dirname, "../")));

// ==========================================
// 2. CẤU HÌNH UPLOAD ẢNH (Multer)
// ==========================================

/* 
 * Multer là middleware xử lý file upload
 * 
 * Cấu hình:
 * - destination: Thư mục lưu file
 * - filename: Tên file khi lưu (thêm timestamp để unique)
 */

// A. Upload ảnh SẢN PHẨM
const productStorage = multer.diskStorage({
    // Hàm xác định thư mục lưu
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, "../assets/img/products/");
        // Tạo thư mục nếu chưa tồn tại
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true  // Tạo cả thư mục cha nếu cần
            });
        }
        cb(null, dir);  // Callback với đường dẫn
    },
    // Hàm đặt tên file
    filename: function(req, file, cb) {
        // Tên file = timestamp + tên gốc (để unique)
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const uploadProduct = multer({
    storage: productStorage
});

// B. Upload AVATAR User
const userStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, "../assets/img/avatars/");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        // Tên file = "user-" + timestamp + đuôi file
        cb(null, "user-" + Date.now() + path.extname(file.originalname));
    },
});
const uploadUser = multer({
    storage: userStorage
});

// ==========================================
// 3. KẾT NỐI DATABASE MySQL
// ==========================================

/*
 * Tạo connection đến MySQL database
 * 
 * Ưu tiên lấy từ Environment Variables (cho deploy)
 * Nếu không có thì dùng giá trị mặc định (cho dev local)
 * 
 * SSL được bật nếu host là Aiven Cloud
 */
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",      // Địa chỉ server MySQL
  user: process.env.DB_USER || "root",           // Username
  password: process.env.DB_PASSWORD || "",        // Password
  database: process.env.DB_NAME || "twin_shop",   // Tên database
  port: process.env.DB_PORT || 3306,              // Port (mặc định MySQL: 3306)
  // SSL cho Aiven Cloud
  ssl: (process.env.DB_HOST || '').includes('aivencloud') ? { rejectUnauthorized: false } : undefined
});

// Kết nối và log kết quả
db.connect((err) => {
    if (err) {
        console.error("❌ Lỗi kết nối MySQL:", err);
    } else {
        console.log("✅ Đã kết nối thành công với MySQL!");
        
        // Tự động thêm cột cancel_reason nếu chưa có (migration)
        db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'cancel_reason'
        `, (err, results) => {
            if (!err && results.length === 0) {
                db.query("ALTER TABLE orders ADD COLUMN cancel_reason TEXT NULL", (alterErr) => {
                    if (alterErr) {
                        console.log("⚠️ Không thể thêm cột cancel_reason:", alterErr.message);
                    } else {
                        console.log("✅ Đã thêm cột cancel_reason vào bảng orders");
                    }
                });
            }
        });
    }
});

// ==========================================
// K. AUTH API - Đăng ký & Đăng nhập
// ==========================================

/*
 * POST /api/register
 * 
 * Đăng ký user mới
 * Body: { full_name, email, password }
 * 
 * Flow:
 * 1. Kiểm tra email đã tồn tại chưa
 * 2. Hash password bằng bcrypt
 * 3. Insert user mới vào database
 */
app.post("/api/register", (req, res) => {
    const {
        full_name,
        email,
        password
    } = req.body;
    // Kiểm tra email đã được sử dụng chưa
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) return res.status(400).json({
            message: "Email này đã được sử dụng!"
        });

        // Hash password bằng bcrypt
        // Salt = chuỗi random thêm vào password trước khi hash
        // Giúp 2 password giống nhau có hash khác nhau
        const salt = bcrypt.genSaltSync(10);  // 10 rounds
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Insert user mới (role = 0 = khách hàng)
        db.query("INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 0)", [full_name, email, hashedPassword], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({
                message: "Đăng ký thành công!"
            });
        });
    });
});

/*
 * POST /api/login
 * 
 * Đăng nhập user
 * Body: { email, password }
 * 
 * Flow:
 * 1. Tìm user theo email
 * 2. So sánh password với hash trong DB (bcrypt.compareSync)
 * 3. Trả về thông tin user nếu đúng
 */
app.post("/api/login", (req, res) => {
    const {
        email,
        password
    } = req.body;
    
    // Tìm user theo email
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length === 0) return res.status(401).json({
            message: "Email không tồn tại!"
        });

        const user = results[0];
        
        // So sánh password đã nhập với hash trong DB
        // bcrypt.compareSync tự động xử lý salt
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({
            message: "Sai mật khẩu!"
        });

        // Trả về thông tin user (KHÔNG trả password!)
        res.json({
            message: "Đăng nhập thành công",
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,        // 0 = khách, 1 = admin
                avatar: user.avatar,
                phone: user.phone
            },
        });
    });
});

// ==========================================
// C. USER API - Quản lý người dùng
// ==========================================

/*
 * GET /api/users/:id
 * 
 * Lấy thông tin 1 user theo ID
 * Dùng cho trang profile user
 */
app.get("/api/users/:id", (req, res) => {
    // Không SELECT password để bảo mật
    db.query("SELECT id, full_name, email, phone, gender, birthday, avatar, role, wallet_balance FROM users WHERE id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json({
            error: "Lỗi Server"
        });
        if (results.length === 0) return res.status(404).json({
            message: "User not found"
        });
        res.json(results[0]);
    });
});

/*
 * GET /api/users
 * 
 * Lấy danh sách tất cả users (cho admin)
 * Hỗ trợ tìm kiếm theo tên, email, phone
 */
app.get("/api/users", (req, res) => {
    const search = req.query.search || "";
    let sql = "SELECT id, full_name, email, phone, role FROM users";
    let params = [];
    
    // Thêm điều kiện tìm kiếm nếu có
    if (search) {
        sql += " WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?";
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

/*
 * PUT /api/users/:id
 * 
 * Cập nhật thông tin user
 * Hỗ trợ upload avatar (multipart/form-data)
 */
app.put("/api/users/:id", uploadUser.single('avatar'), (req, res) => {
    const userId = req.params.id;
    const updates = req.body;
    
    // Nếu có upload avatar, thêm đường dẫn vào updates
    if (req.file) updates.avatar = `/assets/img/avatars/${req.file.filename}`;

    // Chỉ cho phép cập nhật các field an toàn
    const fields = [];
    const values = [];
    const allowed = ['full_name', 'email', 'phone', 'gender', 'birthday', 'avatar'];

    for (const key in updates) {
        if (allowed.includes(key) && updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    }

    if (fields.length === 0) return res.status(400).json({
        message: "Không có dữ liệu"
    });

    values.push(userId);
    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;

    db.query(sql, values, (err) => {
        if (err) return res.status(500).json({
            error: "Lỗi cập nhật"
        });
        res.json({
            message: "Cập nhật thành công!",
            avatarPath: updates.avatar
        });
    });
});

/*
 * GET /api/user-addresses/:userId
 * 
 * Lấy danh sách địa chỉ của user
 * Sắp xếp: Địa chỉ mặc định lên đầu
 */
app.get("/api/user-addresses/:userId", (req, res) => {
    db.query("SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC", [req.params.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

/*
 * POST /api/user-addresses
 * 
 * Thêm địa chỉ mới cho user
 * Nếu đặt làm mặc định, reset các địa chỉ khác về 0
 */
app.post("/api/user-addresses", (req, res) => {
    const {
        userId,
        name,
        phone,
        address,
        isDefault
    } = req.body;
    
    // Nếu địa chỉ mới là mặc định, bỏ mặc định các địa chỉ cũ
    if (isDefault) db.query("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", [userId]);
    
    db.query("INSERT INTO user_addresses (user_id, recipient_name, recipient_phone, address, is_default) VALUES (?, ?, ?, ?, ?)", [userId, name, phone, address, isDefault ? 1 : 0], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({
            message: "Thêm thành công",
            id: result.insertId  // Trả về ID địa chỉ mới
        });
    });
});

/*
 * PUT /api/user-addresses/:id
 * 
 * Cập nhật địa chỉ
 */
app.put("/api/user-addresses/:id", (req, res) => {
    const addressId = req.params.id;
    const {
        userId,
        name,
        phone,
        address,
        isDefault
    } = req.body;
    
    if (isDefault) {
        // Bỏ mặc định các địa chỉ khác trước
        db.query("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", [userId], (err) => {
            if (err) return res.status(500).json(err);
            updateAddress();
        });
    } else {
        updateAddress();
    }

    function updateAddress() {
        db.query("UPDATE user_addresses SET recipient_name=?, recipient_phone=?, address=?, is_default=? WHERE id=?", [name, phone, address, isDefault ? 1 : 0, addressId], (err) => {
            if (err) return res.status(500).json(err);
            res.json({
                message: "Cập nhật thành công"
            });
        });
    }
});

// ==========================================
// D. PRODUCT API - Quản lý sản phẩm
// ==========================================

/*
 * GET /api/products
 * 
 * Lấy danh sách sản phẩm với phân trang, tìm kiếm, sắp xếp
 * 
 * Query params:
 * - page: Số trang (mặc định 1)
 * - limit: Số sản phẩm/trang (mặc định 10)
 * - search: Từ khóa tìm kiếm
 * - sort: Cách sắp xếp (newest, sold, price_asc, price_desc...)
 * - categoryId: Lọc theo danh mục
 * 
 * Response:
 * {
 *   data: [...products],
 *   pagination: { page, limit, totalItems, totalPages }
 * }
 */
app.get("/api/products", (req, res) => {
    // Parse query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sort = req.query.sort || "newest";
    const categoryId = req.query.categoryId || "";
    const offset = (page - 1) * limit;  // Vị trí bắt đầu lấy

    // Xây dựng WHERE clause động
    let whereClause = "WHERE 1=1";  // 1=1 để dễ thêm AND
    let params = [];

    if (search) {
        whereClause += " AND p.name LIKE ?";
        params.push(`%${search}%`);  // % = wildcard (chứa từ khóa)
    }
    if (categoryId) {
        whereClause += " AND p.category_id = ?";
        params.push(categoryId);
    }

    // Xây dựng ORDER BY clause
    let orderClause = "ORDER BY p.id DESC";
    if (sort === "newest") orderClause = "ORDER BY p.created_at DESC";
    if (sort === "sold") orderClause = "ORDER BY p.sold DESC";
    if (sort === "price_asc") orderClause = "ORDER BY p.price ASC";
    if (sort === "price_desc") orderClause = "ORDER BY p.price DESC";
    if (sort === "stock_asc") orderClause = "ORDER BY p.stock ASC";
    if (sort === "stock_desc") orderClause = "ORDER BY p.stock DESC";
    if (sort === "name_asc") orderClause = "ORDER BY p.name ASC";
    if (sort === "name_desc") orderClause = "ORDER BY p.name DESC";
    if (sort === "id_asc") orderClause = "ORDER BY p.id ASC";
    if (sort === "id_desc") orderClause = "ORDER BY p.id DESC";

    // Query 1: Đếm tổng số sản phẩm (cho pagination)
    const sqlCount = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
    
    // Query 2: Lấy danh sách sản phẩm với LIMIT và OFFSET
    const sqlData = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;

    // Chạy 2 query
    db.query(sqlCount, params, (err, countResult) => {
        if (err) return res.status(500).json(err);
        
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        db.query(sqlData, [...params, limit, offset], (err, products) => {
            if (err) return res.status(500).json(err);
            res.json({
                data: products,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages
                }
            });
        });
    });
});

/*
 * GET /api/products/:id
 * 
 * Lấy chi tiết 1 sản phẩm
 * Bao gồm: thông tin sản phẩm + ảnh phụ + variants (màu/size)
 */
app.get("/api/products/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, resultProduct) => {
        if (err) return res.status(500).json(err);
        if (resultProduct.length === 0) return res.status(404).json({
            message: "Không tìm thấy"
        });

        const product = resultProduct[0];
        
        // Lấy thêm ảnh phụ
        db.query("SELECT image_url FROM product_images WHERE product_id = ?", [product.id], (err, resultImages) => {
            product.images = resultImages.map((img) => img.image_url);
            
            // Lấy thêm variants (màu sắc, size)
            db.query("SELECT id, color, size, stock FROM product_variants WHERE product_id = ?", [product.id], (err, resultVariants) => {
                product.variants = resultVariants;
                res.json(product);
            });
        });
    });
});

/*
 * Cấu hình upload nhiều file cho sản phẩm
 * - thumbnail: 1 ảnh chính
 * - images: tối đa 10 ảnh phụ
 */
const cpUpload = uploadProduct.fields([{
    name: "thumbnail",
    maxCount: 1
}, {
    name: "images",
    maxCount: 10
}]);

app.post("/api/products", cpUpload, (req, res) => {
    const {
        name,
        price,
        description,
        category_id,
        stock
    } = req.body;
    const thumbnailPath = req.files["thumbnail"] ? `/assets/img/products/${req.files["thumbnail"][0].filename}` : null;

    db.query("INSERT INTO products (name, price, description, category_id, stock, thumbnail) VALUES (?, ?, ?, ?, ?, ?)",
        [name, price, description, category_id || 1, stock || 100, thumbnailPath], (err, result) => {
            if (err) return res.status(500).json(err);
            const productId = result.insertId;

            if (req.files["images"] && req.files["images"].length > 0) {
                const imageValues = req.files["images"].map((file) => [productId, `/assets/img/products/${file.filename}`]);
                db.query("INSERT INTO product_images (product_id, image_url) VALUES ?", [imageValues], (errImg) => {
                    res.json({
                        message: "Thêm thành công!",
                        productId
                    });
                });
            } else {
                res.json({
                    message: "Thêm thành công!",
                    productId
                });
            }
        });
});

app.put("/api/products/:id", cpUpload, (req, res) => {
    const id = req.params.id;
    const {
        name,
        price,
        description,
        category_id,
        stock
    } = req.body;
    let sql, params;

    if (req.files["thumbnail"]) {
        const thumbnail = `/assets/img/products/${req.files["thumbnail"][0].filename}`;
        sql = "UPDATE products SET name=?, price=?, description=?, category_id=?, stock=?, thumbnail=? WHERE id=?";
        params = [name, price, description, category_id, stock, thumbnail, id];
    } else {
        sql = "UPDATE products SET name=?, price=?, description=?, category_id=?, stock=? WHERE id=?";
        params = [name, price, description, category_id, stock, id];
    }

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json(err);
        if (req.files["images"]) {
            const imageValues = req.files["images"].map((file) => [id, `/assets/img/products/${file.filename}`]);
            db.query("INSERT INTO product_images (product_id, image_url) VALUES ?", [imageValues], () => {
                res.json({
                    message: "Cập nhật thành công!"
                });
            });
        } else {
            res.json({
                message: "Cập nhật thành công!"
            });
        }
    });
});

app.delete("/api/products/:id", (req, res) => {
    db.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({
            message: "Đã xóa sản phẩm"
        });
    });
});

// ==========================================
// E. CART API - QUẢN LÝ GIỎ HÀNG
// ==========================================
// 
// Các endpoint quản lý giỏ hàng của người dùng:
// - GET    /cart/:userId         - Lấy giỏ hàng của user
// - POST   /cart                 - Thêm sản phẩm vào giỏ
// - DELETE /cart/:userId/:productId - Xóa 1 sản phẩm khỏi giỏ
// - PUT    /cart/update/:id      - Cập nhật số lượng
// - POST   /cart/delete-items    - Xóa nhiều sản phẩm cùng lúc

/*
 * GET /api/cart/:userId
 * Lấy tất cả sản phẩm trong giỏ hàng của user
 * JOIN với bảng products để lấy thông tin sản phẩm
 */
app.get("/api/cart/:userId", (req, res) => {
    // Query JOIN để lấy thông tin product kèm theo cart item
    const sql = `SELECT c.id, c.product_id, c.quantity, c.color, c.size, 
                 p.name, p.price, p.thumbnail, p.discount_percentage 
                 FROM cart_items c 
                 JOIN products p ON c.product_id = p.id 
                 WHERE c.user_id = ?`;
    db.query(sql, [req.params.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

/*
 * POST /api/cart
 * Thêm sản phẩm vào giỏ hàng
 * Nếu sản phẩm đã có (cùng color + size) -> tăng quantity
 * Nếu chưa có -> thêm mới
 */
app.post("/api/cart", (req, res) => {
    const {
        userId,
        productId,
        quantity,
        color,
        size
    } = req.body;
    
    // Kiểm tra xem sản phẩm đã có trong giỏ chưa (cùng variant)
    db.query("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ? AND size = ?", 
        [userId, productId, color || "", size || ""], (err, results) => {
        if (results.length > 0) {
            // Đã có -> cập nhật số lượng (cộng thêm)
            db.query("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?", 
                [quantity, results[0].id], () => res.json({ message: "Updated" }));
        } else {
            // Chưa có -> thêm mới
            db.query("INSERT INTO cart_items (user_id, product_id, quantity, color, size) VALUES (?, ?, ?, ?, ?)", 
                [userId, productId, quantity, color || "", size || ""], () => res.json({ message: "Added" }));
        }
    });
});

/*
 * DELETE /api/cart/:userId/:productId
 * Xóa 1 sản phẩm khỏi giỏ hàng theo productId
 */
app.delete("/api/cart/:userId/:productId", (req, res) => {
    db.query("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", 
        [req.params.userId, req.params.productId], () => res.json({ message: "Deleted" }));
});

/*
 * PUT /api/cart/update/:id
 * Cập nhật số lượng của item trong giỏ
 * Nếu quantity <= 0 -> xóa item
 */
app.put("/api/cart/update/:id", (req, res) => {
    const { quantity } = req.body;
    if (quantity <= 0) {
        // Số lượng <= 0 -> xóa khỏi giỏ
        db.query("DELETE FROM cart_items WHERE id = ?", [req.params.id], () => res.json({ message: "Deleted" }));
    } else {
        // Cập nhật số lượng mới
        db.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [quantity, req.params.id], () => res.json({ message: "Updated" }));
    }
});

/*
 * POST /api/cart/delete-items
 * Xóa nhiều items khỏi giỏ hàng cùng lúc
 * Body: { cartIds: [1, 2, 3] }
 */
app.post("/api/cart/delete-items", (req, res) => {
    const { cartIds } = req.body;
    if (!cartIds || cartIds.length === 0) return res.json({ message: "Nothing to delete" });
    
    // Dùng IN (?) để xóa nhiều id cùng lúc
    db.query(`DELETE FROM cart_items WHERE id IN (?)`, [cartIds], () => res.json({ message: "Deleted" }));
});

// ==========================================
// F. ORDER API - QUẢN LÝ ĐƠN HÀNG
// ==========================================
// 
// Đây là phần QUAN TRỌNG NHẤT của e-commerce!
// Các endpoint:
// - POST   /orders              - Tạo đơn hàng mới
// - GET    /my-orders/:userId   - Lấy đơn hàng của user
// - GET    /orders/:id/details  - Lấy chi tiết đơn hàng
// - PATCH  /orders/:id/cancel   - User hủy đơn
// - GET    /admin/orders        - Admin xem tất cả đơn
// - PATCH  /admin/orders/:id    - Admin cập nhật trạng thái

/*
 * POST /api/orders
 * TẠO ĐƠN HÀNG - Quy trình phức tạp nhất!
 * 
 * Quy trình:
 * 1. Nhận thông tin từ checkout form
 * 2. Nếu TwinPay -> kiểm tra số dư ví, trừ tiền
 * 3. Tạo record trong bảng orders
 * 4. Tạo các records trong order_details (chi tiết sản phẩm)
 * 5. Cập nhật stock sản phẩm (trừ đi số lượng đã mua)
 * 6. Xóa sản phẩm đã mua khỏi giỏ hàng
 */
app.post("/api/orders", (req, res) => {
    // Destructure thông tin đơn hàng từ request body
    const {
        userId,           // ID người đặt
        recipientName,    // Tên người nhận
        recipientPhone,   // SĐT người nhận
        recipientAddress, // Địa chỉ giao hàng
        totalMoney,       // Tổng tiền
        items,            // Array các sản phẩm [{product_id, quantity, price, color, size}]
        paymentMethod,    // Phương thức: COD, TWINPAY, BANK
        note,             // Ghi chú đơn hàng
        shippingId        // ID phương thức vận chuyển
    } = req.body;

    /*
     * Hàm tạo đơn hàng - tách riêng để dùng chung
     * Được gọi sau khi kiểm tra thanh toán (nếu TwinPay)
     */
    const createOrderProcess = () => {
        // Bước 1: INSERT vào bảng orders
        db.query("INSERT INTO orders (user_id, recipient_name, recipient_phone, recipient_address, note, total_money, payment_method, shipping_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [userId, recipientName, recipientPhone, recipientAddress, note, totalMoney, paymentMethod, shippingId], (err, result) => {
                if (err) return res.status(500).json({ error: "Lỗi tạo đơn" });
                
                // Lấy ID đơn hàng vừa tạo
                const orderId = result.insertId;
                
                // Bước 2: Chuẩn bị dữ liệu order_details (bulk insert)
                // Map từ items array thành format [[orderId, product_id, qty, price, color, size], ...]
                const details = items.map(i => [orderId, i.product_id, i.quantity, i.price, i.color || "", i.size || ""]);

                // Bước 3: INSERT vào bảng order_details
                db.query("INSERT INTO order_details (order_id, product_id, quantity, price_at_time, color, size) VALUES ?", [details], () => {
                    
                    // Bước 4: Cập nhật stock sản phẩm
                    items.forEach(i => {
                        // Nếu có variant (color + size) -> trừ stock của variant
                        if (i.color && i.size) {
                            db.query("UPDATE product_variants SET stock = stock - ? WHERE product_id = ? AND color = ? AND size = ?", 
                                [i.quantity, i.product_id, i.color, i.size]);
                        }
                        // Trừ stock tổng và tăng sold count của product
                        db.query("UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?", 
                            [i.quantity, i.quantity, i.product_id]);
                    });
                    
                    // Bước 5: Xóa các sản phẩm đã mua khỏi giỏ hàng
                    const pIds = items.map(i => i.product_id);
                    db.query(`DELETE FROM cart_items WHERE user_id = ? AND product_id IN (?)`, [userId, pIds], () => {
                        // Trả về success với orderId để frontend redirect
                        res.json({ message: "Success", orderId });
                    });
                });
            });
    };

    /*
     * Xử lý thanh toán TwinPay (ví điện tử nội bộ)
     * Cần kiểm tra số dư và trừ tiền trước khi tạo đơn
     */
    if (paymentMethod === 'TWINPAY') {
        // Kiểm tra số dư ví của user
        db.query("SELECT wallet_balance FROM users WHERE id = ?", [userId], (err, r) => {
            // Kiểm tra lỗi hoặc user không tồn tại
            if (err || !r || r.length === 0) {
                return res.status(400).json({ message: "Không tìm thấy tài khoản!" });
            }
            if (r[0].wallet_balance < totalMoney) {
                // Không đủ tiền -> báo lỗi
                return res.status(400).json({ message: "Không đủ tiền" });
            }
            // Đủ tiền -> trừ ví rồi tạo đơn
            db.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [totalMoney, userId], () => {
                createOrderProcess();
            });
        });
    } else {
        // COD hoặc BANK -> tạo đơn luôn
        createOrderProcess();
    }
});

/*
 * GET /api/my-orders/:userId
 * Lấy TẤT CẢ đơn hàng của 1 user (cho trang "Đơn hàng của tôi")
 * JOIN để lấy thông tin sản phẩm trong từng đơn
 */
app.get("/api/my-orders/:userId", (req, res) => {
    // Bước 1: Lấy tất cả orders của user, sắp xếp mới nhất trước
    db.query("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC", [req.params.userId], (err, orders) => {
        if (orders.length === 0) return res.json([]);
        
        // Bước 2: Lấy chi tiết của tất cả đơn hàng (1 query thay vì N queries)
        const ids = orders.map(o => o.id);
        db.query("SELECT od.*, p.name, p.thumbnail FROM order_details od JOIN products p ON od.product_id = p.id WHERE od.order_id IN (?)", [ids], (err, details) => {
            // Bước 3: Map chi tiết vào từng đơn hàng
            const result = orders.map(o => ({
                ...o,
                items: details.filter(d => d.order_id === o.id)
            }));
            res.json(result);
        });
    });
});

/*
 * GET /api/orders/:id/details
 * Lấy chi tiết 1 đơn hàng cụ thể
 */
app.get("/api/orders/:id/details", (req, res) => {
    db.query("SELECT od.*, p.name, p.thumbnail FROM order_details od JOIN products p ON od.product_id = p.id WHERE od.order_id = ?", 
        [req.params.id], (err, r) => res.json(r));
});

/*
 * PATCH /api/orders/:id/cancel
 * User hủy đơn hàng (chỉ được hủy khi status = "pending")
 */
app.patch("/api/orders/:id/cancel", (req, res) => {
    const { reason } = req.body; // Lý do hủy (optional)
    const orderId = req.params.id;
    
    console.log(`[CANCEL ORDER] Đang hủy đơn #${orderId}, lý do: ${reason}`);
    
    // Kiểm tra status hiện tại
    db.query("SELECT status FROM orders WHERE id = ?", [orderId], (err, r) => {
        // Kiểm tra lỗi database
        if (err) {
            console.log(`[CANCEL ORDER] Lỗi DB:`, err);
            return res.status(500).json({ message: "Lỗi server!" });
        }
        
        // Kiểm tra đơn hàng có tồn tại không
        if (!r || r.length === 0) {
            console.log(`[CANCEL ORDER] Không tìm thấy đơn #${orderId}`);
            return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
        }
        
        console.log(`[CANCEL ORDER] Đơn #${orderId} có status: ${r[0].status}`);
        
        if (r[0].status === "pending") {
            // Chỉ pending mới được hủy
            db.query("UPDATE orders SET status = 'cancelled', cancel_reason = ? WHERE id = ?", 
                [reason || null, orderId], (updateErr) => {
                    if (updateErr) {
                        console.log(`[CANCEL ORDER] Lỗi update:`, updateErr);
                        return res.status(500).json({ message: "Lỗi khi hủy đơn hàng!" });
                    }
                    console.log(`[CANCEL ORDER] Đã hủy thành công đơn #${orderId}`);
                    res.json({ message: "Đã hủy đơn hàng thành công!" });
                });
        } else {
            // Đã xử lý rồi -> không được hủy
            console.log(`[CANCEL ORDER] Không thể hủy - đơn đã ${r[0].status}`);
            res.status(400).json({ message: `Không thể hủy đơn hàng đã "${r[0].status}"!` });
        }
    });
});

/*
 * GET /api/admin/orders
 * Admin xem tất cả đơn hàng với filter
 * Query params: search (tên người nhận), status (trạng thái)
 */
app.get("/api/admin/orders", (req, res) => {
    const search = req.query.search || "";
    const status = req.query.status || "";
    
    // Xây dựng query động dựa trên filter
    let sql = "SELECT * FROM orders WHERE 1=1"; // 1=1 để dễ thêm AND
    let params = [];
    
    if (search) {
        sql += " AND recipient_name LIKE ?";
        params.push(`%${search}%`);
    }
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }
    sql += " ORDER BY order_date DESC";
    
    db.query(sql, params, (e, r) => res.json(r));
});

/*
 * GET /api/admin/orders/:id
 * Lấy thông tin chi tiết 1 đơn hàng (cho admin xem hóa đơn)
 */
app.get("/api/admin/orders/:id", (req, res) => {
    db.query("SELECT * FROM orders WHERE id = ?", [req.params.id], (e, r) => {
        if (r && r.length > 0) {
            res.json(r[0]);
        } else {
            res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }
    });
});

/*
 * PATCH /api/admin/orders/:id
 * Admin cập nhật trạng thái đơn hàng
 * Status: pending -> confirmed -> shipping -> delivered / cancelled
 */
app.patch("/api/admin/orders/:id", (req, res) => {
    db.query("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => {
        res.json({ message: "Updated" });
    });
});

// ==========================================
// G. REVIEWS & CONFIG API - ĐÁNH GIÁ VÀ CẤU HÌNH
// ==========================================
// 
// Phần này quản lý:
// 1. REVIEWS - Đánh giá sản phẩm (tạo, xem, xóa)
// 2. CATEGORIES - Danh mục sản phẩm (CRUD)
// 3. SHIPPING - Phương thức vận chuyển (CRUD)
// 4. PAYMENT - Phương thức thanh toán (CRUD)
// 5. STATS - Thống kê cho dashboard admin

// ----- REVIEWS (Đánh giá sản phẩm) -----

/*
 * GET /api/admin/reviews
 * Admin xem tất cả đánh giá từ mọi sản phẩm
 * JOIN với users và products để lấy tên người đánh giá và tên sản phẩm
 */
app.get("/api/admin/reviews", (req, res) => {
    db.query("SELECT r.*, u.full_name, p.name as product_name FROM reviews r JOIN users u ON r.user_id = u.id JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC", (e, r) => res.json(r));
});

/*
 * POST /api/reviews
 * User tạo đánh giá mới cho sản phẩm
 * Sau khi tạo, tự động tính lại rating trung bình của sản phẩm
 */
app.post("/api/reviews", (req, res) => {
    const {
        userId,
        productId,
        rating,      // Số sao (1-5)
        comment      // Nội dung đánh giá
    } = req.body;
    
    // Bước 1: INSERT review mới
    db.query("INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)", 
        [userId, productId, rating, comment], () => {
        
        // Bước 2: Tính rating trung bình mới
        db.query("SELECT AVG(rating) as avgRating FROM reviews WHERE product_id = ?", [productId], (e, r) => {
            // Bước 3: Cập nhật rating của sản phẩm (kiểm tra r có dữ liệu)
            const avgRating = (r && r.length > 0 && r[0].avgRating) ? r[0].avgRating : 5;
            db.query("UPDATE products SET rating = ? WHERE id = ?", [avgRating, productId]);
        });
        
        res.json({ message: "Success" });
    });
});

/*
 * DELETE /api/admin/reviews/:id
 * Admin xóa 1 đánh giá (ví dụ: spam, vi phạm)
 */
app.delete("/api/admin/reviews/:id", (req, res) => {
    db.query("DELETE FROM reviews WHERE id = ?", [req.params.id], () => {
        res.json({ message: "Deleted" });
    });
});

/*
 * GET /api/products/:id/reviews
 * Lấy danh sách đánh giá của 1 sản phẩm (có phân trang)
 * Query params: page, limit, rating (filter theo số sao)
 * 
 * Response bao gồm:
 * - data: Array các review
 * - pagination: Thông tin phân trang
 * - stats: Thống kê số lượng theo từng số sao
 */
app.get("/api/products/:id/reviews", (req, res) => {
    // Lấy query params với giá trị mặc định
    const {
        page = 1,    // Trang hiện tại
        limit = 5,   // Số review mỗi trang
        rating       // Filter theo số sao (optional)
    } = req.query;
    
    // Tính offset cho phân trang
    const offset = (page - 1) * limit;
    
    // Xây dựng điều kiện WHERE
    let where = "WHERE product_id = ?";
    let params = [req.params.id];
    
    // Nếu có filter rating
    if (rating && rating !== 'all') {
        where += " AND rating = ?";
        params.push(rating);
    }

    // 3 queries song song:
    // 1. Lấy data review với phân trang
    const sqlData = `SELECT r.*, u.full_name, u.avatar FROM reviews r JOIN users u ON r.user_id = u.id ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    
    // 2. Đếm tổng số review (cho phân trang)
    const sqlCount = `SELECT COUNT(*) as total FROM reviews ${where}`;
    
    // 3. Thống kê số review theo từng số sao
    const sqlStats = `SELECT rating, COUNT(*) as count FROM reviews WHERE product_id = ? GROUP BY rating`;

    // Thực hiện 3 queries lồng nhau
    db.query(sqlData, [...params, parseInt(limit), offset], (e, reviews) => {
        db.query(sqlCount, params, (e, c) => {
            db.query(sqlStats, [req.params.id], (e, s) => {
                // Khởi tạo stats object
                const stats = {
                    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, all: 0
                };
                
                // Fill stats từ kết quả query
                s.forEach(i => {
                    stats[i.rating] = i.count;
                    stats.all += i.count;
                });
                
                // Trả về response đầy đủ
                res.json({
                    data: reviews,
                    pagination: {
                        page,
                        limit,
                        total: c[0].total,
                        totalPages: Math.ceil(c[0].total / limit)
                    },
                    stats
                });
            });
        });
    });
});

// ----- CATEGORIES (Danh mục sản phẩm) -----
// CRUD hoàn chỉnh cho quản lý danh mục

// Lấy tất cả danh mục
app.get("/api/categories", (req, res) => {
    db.query("SELECT * FROM categories", (e, r) => res.json(r));
});

// Lấy 1 danh mục theo ID
app.get("/api/categories/:id", (req, res) => {
    db.query("SELECT * FROM categories WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});

// Tạo danh mục mới
app.post("/api/categories", (req, res) => {
    db.query("INSERT INTO categories (name, description) VALUES (?,?)", 
        [req.body.name, req.body.description], () => res.json({ message: "OK" }));
});

// Cập nhật danh mục
app.put("/api/categories/:id", (req, res) => {
    db.query("UPDATE categories SET name=?, description=? WHERE id=?", 
        [req.body.name, req.body.description, req.params.id], () => res.json({ message: "OK" }));
});

// Xóa danh mục
app.delete("/api/categories/:id", (req, res) => {
    db.query("DELETE FROM categories WHERE id=?", [req.params.id], () => res.json({ message: "Deleted" }));
});

// ----- SHIPPING (Phương thức vận chuyển) -----
// CRUD hoàn chỉnh cho quản lý vận chuyển

// Lấy tất cả phương thức vận chuyển
app.get("/api/shipping", (req, res) => {
    db.query("SELECT * FROM shipping_methods", (e, r) => res.json(r));
});

// Lấy 1 phương thức theo ID
app.get("/api/shipping/:id", (req, res) => {
    db.query("SELECT * FROM shipping_methods WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});

// Tạo phương thức mới
app.post("/api/shipping", (req, res) => {
    db.query("INSERT INTO shipping_methods (name, price) VALUES (?,?)", 
        [req.body.name, req.body.price], () => res.json({ message: "OK" }));
});

// Cập nhật phương thức
app.put("/api/shipping/:id", (req, res) => {
    db.query("UPDATE shipping_methods SET name=?, price=? WHERE id=?", 
        [req.body.name, req.body.price, req.params.id], () => res.json({ message: "OK" }));
});

// Xóa phương thức
app.delete("/api/shipping/:id", (req, res) => {
    db.query("DELETE FROM shipping_methods WHERE id=?", [req.params.id], () => res.json({ message: "Deleted" }));
});

// ----- PAYMENT (Phương thức thanh toán) -----
// CRUD hoàn chỉnh cho quản lý thanh toán

// Lấy tất cả phương thức thanh toán
app.get("/api/payment", (req, res) => {
    db.query("SELECT * FROM payment_methods", (e, r) => res.json(r));
});

// Lấy 1 phương thức theo ID
app.get("/api/payment/:id", (req, res) => {
    db.query("SELECT * FROM payment_methods WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});

// Tạo phương thức mới
app.post("/api/payment", (req, res) => {
    db.query("INSERT INTO payment_methods (name, code) VALUES (?,?)", 
        [req.body.name, req.body.code], () => res.json({ message: "OK" }));
});

// Cập nhật phương thức
app.put("/api/payment/:id", (req, res) => {
    db.query("UPDATE payment_methods SET name=?, code=? WHERE id=?", 
        [req.body.name, req.body.code, req.params.id], () => res.json({ message: "OK" }));
});

// Xóa phương thức
app.delete("/api/payment/:id", (req, res) => {
    db.query("DELETE FROM payment_methods WHERE id=?", [req.params.id], () => res.json({ message: "Deleted" }));
});

// ----- STATS (Thống kê cho Dashboard Admin) -----

/*
 * GET /api/admin/stats
 * Lấy các số liệu thống kê tổng quan:
 * - products: Tổng số sản phẩm
 * - orders: Tổng số đơn hàng
 * - users: Tổng số người dùng
 * - revenue: Tổng doanh thu (từ đơn hàng completed)
 * 
 * Sử dụng Promise.all để chạy 4 queries song song (nhanh hơn)
 */
app.get("/api/admin/stats", (req, res) => {
    // Định nghĩa 4 queries cần chạy
    const q = {
        p: "SELECT COUNT(*) c FROM products",       // Đếm sản phẩm
        o: "SELECT COUNT(*) c FROM orders",         // Đếm đơn hàng
        u: "SELECT COUNT(*) c FROM users",          // Đếm users
        r: "SELECT SUM(total_money) t FROM orders WHERE status='completed'" // Tổng doanh thu
    };
    
    // Chạy 4 queries song song bằng Promise.all
    Promise.all([
        new Promise(r => db.query(q.p, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.o, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.u, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.r, (e, res) => r(res[0].t || 0)))
    ]).then(([products, orders, users, revenue]) => {
        // Trả về kết quả gộp
        res.json({ products, orders, users, revenue });
    });
});


// ==========================================
// H. SOCKET.IO - REALTIME CHAT
// ==========================================
// 
// Đây là phần NÂNG CAO nhất của ứng dụng!
// Socket.io cho phép giao tiếp REALTIME (thời gian thực) giữa client và server
// 
// Khái niệm quan trọng:
// - socket.emit() : Gửi tin đến 1 client cụ thể
// - io.to(room).emit() : Gửi tin đến tất cả client trong room
// - socket.join(room) : Cho client tham gia 1 room
// 
// Quy trình chat:
// 1. Khách bắt đầu chat (customer:start) -> Server tạo session
// 2. Khách gửi tin (customer:message) -> Bot trả lời hoặc chuyển cho admin
// 3. Admin tham gia (admin:join) -> Nhận danh sách sessions
// 4. Admin trả lời (admin:message) -> Tin nhắn gửi đến khách

/*
 * chatSessions: Map lưu trữ các phiên chat
 * Key: sessionId (string unique)
 * Value: { id, socketId, user, messages[], status, createdAt, unread }
 * 
 * status có thể là:
 * - "bot": Đang được chatbot xử lý
 * - "waiting": Chờ admin tiếp nhận
 * - "admin": Admin đang xử lý
 * - "disconnected": Khách đã ngắt kết nối
 * - "closed": Phiên chat đã đóng
 */
const chatSessions = new Map();

/*
 * adminSockets: Set chứa socket.id của các admin đang online
 * Dùng để biết admin nào đang kết nối
 */
const adminSockets = new Set();

/*
 * chatbotFAQ: Cơ sở dữ liệu câu hỏi thường gặp
 * Mỗi item có:
 * - keywords: Array từ khóa để match (chứa bất kỳ từ nào là trả lời)
 * - response: Câu trả lời của bot
 * 
 * Đây là cách đơn giản nhất để làm chatbot!
 * Phiên bản nâng cao hơn có thể dùng NLP hoặc AI
 */
const chatbotFAQ = [
    { keywords: ["xin chào", "hello", "hi", "chào"], 
      response: "Xin chào! Tôi là trợ lý ảo của Twin Shop. Tôi có thể giúp gì cho bạn?" },
    { keywords: ["ship", "vận chuyển", "giao hàng", "phí ship"], 
      response: "Phí vận chuyển của Twin Shop:\n- Giao hàng nhanh: 30.000₫\n- Giao hàng hỏa tốc: 50.000₫\nMiễn phí ship cho đơn hàng từ 500.000₫!" },
    { keywords: ["đổi trả", "hoàn tiền", "đổi hàng", "trả hàng"], 
      response: "Chính sách đổi trả:\n- Đổi trả trong 7 ngày kể từ khi nhận hàng\n- Sản phẩm còn nguyên tem, nhãn\n- Liên hệ hotline: 1900 1234 để được hỗ trợ" },
    { keywords: ["voucher", "mã giảm", "khuyến mãi", "giảm giá"], 
      response: "Để nhận voucher, bạn có thể:\n- Theo dõi fanpage Twin Shop\n- Đăng ký nhận email khuyến mãi\n- Check mục 'Kho Voucher' trong tài khoản của bạn" },
    { keywords: ["thanh toán", "trả tiền", "cod", "chuyển khoản"], 
      response: "Các hình thức thanh toán:\n- COD: Thanh toán khi nhận hàng\n- Ví T-WinPay: Thanh toán qua ví điện tử\n- Chuyển khoản ngân hàng" },
    { keywords: ["liên hệ", "hotline", "điện thoại", "email"], 
      response: "Thông tin liên hệ:\n📞 Hotline: 1900 1234\n📧 Email: support@twinshop.vn\n🏠 Địa chỉ: 123 Nguyễn Huệ, Q.1, TP.HCM" },
    { keywords: ["giờ", "thời gian", "mở cửa", "làm việc"], 
      response: "Thời gian làm việc:\n- Thứ 2 - Thứ 6: 8:00 - 21:00\n- Thứ 7 - Chủ nhật: 9:00 - 18:00\nHỗ trợ online 24/7!" },
    { keywords: ["size", "kích thước", "cỡ", "bảng size"], 
      response: "Bảng size giày:\n- Size 38: 24cm\n- Size 39: 24.5cm\n- Size 40: 25cm\n- Size 41: 25.5cm\n- Size 42: 26cm\nLiên hệ shop để được tư vấn chi tiết!" },
    { keywords: ["cảm ơn", "thanks", "thank you"], 
      response: "Không có gì! Rất vui được hỗ trợ bạn. Chúc bạn mua sắm vui vẻ! 🛍️" },
    { keywords: ["tư vấn", "nhân viên", "admin", "hỗ trợ"], 
      response: "Bạn muốn được tư vấn trực tiếp? Vui lòng đợi trong giây lát, nhân viên sẽ hỗ trợ bạn ngay!" }
];

/*
 * getBotResponse(message)
 * Hàm tìm câu trả lời cho tin nhắn của khách
 * 
 * Cách hoạt động:
 * 1. Chuyển tin nhắn về lowercase (không phân biệt hoa/thường)
 * 2. Duyệt qua từng FAQ
 * 3. Nếu tin nhắn chứa bất kỳ keyword nào -> trả về response
 * 4. Nếu không match -> trả về null (chuyển cho admin)
 */
function getBotResponse(message) {
    const lowerMsg = message.toLowerCase();
    for (const faq of chatbotFAQ) {
        for (const keyword of faq.keywords) {
            if (lowerMsg.includes(keyword)) {
                return faq.response;
            }
        }
    }
    return null; // Không tìm thấy câu trả lời
}

/*
 * io.on("connection", callback)
 * Event được gọi khi có client kết nối đến server qua Socket.io
 * Mỗi client có 1 socket riêng để giao tiếp
 */
io.on("connection", (socket) => {
    console.log("📱 Kết nối mới:", socket.id);

    // ===================================================
    // PHẦN 1: KHÁCH HÀNG - Xử lý các event từ customer
    // ===================================================
    
    /*
     * Event: customer:start
     * Được gọi khi khách mở chat widget
     * 
     * Quy trình:
     * 1. Nếu khách đã đăng nhập và có session cũ -> khôi phục session
     * 2. Nếu không -> tạo session mới với tin chào mừng
     */
    socket.on("customer:start", (data) => {
        // Lấy thông tin user (hoặc dùng mặc định nếu chưa đăng nhập)
        const user = data.user || { name: "Khách", id: null };
        
        // Tìm session cũ của user (nếu đã đăng nhập)
        let existingSessionId = null;
        if (user.id) {
            for (const [sid, session] of chatSessions) {
                if (session.user.id === user.id && session.status !== "closed") {
                    existingSessionId = sid;
                    break;
                }
            }
        }
        
        let sessionId;
        if (existingSessionId) {
            // === KHÔI PHỤC SESSION CŨ ===
            sessionId = existingSessionId;
            const session = chatSessions.get(sessionId);
            
            // Cập nhật socketId mới (vì mỗi lần kết nối có socket mới)
            session.socketId = socket.id;
            // Khôi phục status nếu đã closed
            session.status = session.status === "closed" ? "bot" : session.status;
            
            // Gắn sessionId vào socket để dùng sau
            socket.sessionId = sessionId;
            // Cho socket tham gia room của session này
            socket.join(sessionId);
            
            // Gửi lại toàn bộ lịch sử chat cho khách
            session.messages.forEach(msg => {
                socket.emit("chat:message", msg);
            });
            
            // Thông báo admin về session được khôi phục
            io.to("admin-room").emit("admin:sessionUpdate", session);
        } else {
            // === TẠO SESSION MỚI ===
            // Tạo sessionId unique bằng timestamp + random string
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Khởi tạo session object
            chatSessions.set(sessionId, {
                id: sessionId,
                socketId: socket.id,
                user: user,
                messages: [],        // Array chứa lịch sử chat
                status: "bot",       // Bắt đầu với chatbot
                createdAt: new Date(),
                unread: 0            // Số tin chưa đọc (cho admin)
            });
            
            socket.sessionId = sessionId;
            socket.join(sessionId);
            
            // Gửi tin chào mừng từ bot
            const welcomeMsg = {
                id: Date.now(),
                sender: "bot",
                text: "Xin chào! Tôi là trợ lý ảo của Twin Shop 🛍️\n\nBạn có thể hỏi tôi về:\n- Phí vận chuyển\n- Chính sách đổi trả\n- Voucher khuyến mãi\n- Thanh toán\n\nHoặc gõ 'tư vấn' để được nhân viên hỗ trợ trực tiếp!",
                time: new Date()
            };
            
            socket.emit("chat:message", welcomeMsg);
            chatSessions.get(sessionId).messages.push(welcomeMsg);
            
            // Thông báo cho admin có session mới
            io.to("admin-room").emit("admin:newSession", {
                ...chatSessions.get(sessionId),
                messages: chatSessions.get(sessionId).messages
            });
        }
    });

    /*
     * Event: customer:message
     * Được gọi khi khách gửi tin nhắn
     * 
     * Quy trình:
     * 1. Lưu tin nhắn vào session
     * 2. Gửi xác nhận cho khách
     * 3. Thông báo admin
     * 4. Nếu đang ở chế độ bot -> xử lý tự động
     */
    socket.on("customer:message", (data) => {
        const sessionId = socket.sessionId;
        // Kiểm tra session hợp lệ
        if (!sessionId || !chatSessions.has(sessionId)) return;
        
        const session = chatSessions.get(sessionId);
        
        // Tạo object tin nhắn
        const customerMsg = {
            id: Date.now(),
            sender: "customer",
            text: data.text,
            time: new Date()
        };
        
        // Lưu vào lịch sử chat
        session.messages.push(customerMsg);
        
        // Gửi xác nhận cho khách (hiển thị tin nhắn đã gửi)
        socket.emit("chat:message", customerMsg);
        
        // Gửi tin nhắn đến room admin
        io.to("admin-room").emit("admin:message", {
            sessionId,
            message: customerMsg
        });
        
        // Tăng số tin chưa đọc
        session.unread++;
        
        // === XỬ LÝ CHATBOT ===
        // Chỉ xử lý khi đang ở chế độ bot
        if (session.status === "bot") {
            const botResponse = getBotResponse(data.text);
            
            if (botResponse) {
                // Kiểm tra xem khách có yêu cầu tư vấn không
                if (data.text.toLowerCase().includes("tư vấn") || 
                    data.text.toLowerCase().includes("nhân viên") ||
                    data.text.toLowerCase().includes("admin")) {
                    
                    // Chuyển sang chế độ chờ admin
                    session.status = "waiting";
                    
                    const waitingMsg = {
                        id: Date.now() + 1,
                        sender: "bot",
                        text: "Đang kết nối với nhân viên tư vấn... Vui lòng đợi trong giây lát! ⏳",
                        time: new Date()
                    };
                    socket.emit("chat:message", waitingMsg);
                    session.messages.push(waitingMsg);
                    
                    // Thông báo admin có khách cần hỗ trợ (highlight)
                    io.to("admin-room").emit("admin:needSupport", {
                        sessionId,
                        user: session.user
                    });
                } else {
                    // Bot trả lời bình thường
                    // Delay 500ms để tự nhiên hơn
                    setTimeout(() => {
                        const botMsg = {
                            id: Date.now() + 1,
                            sender: "bot",
                            text: botResponse,
                            time: new Date()
                        };
                        socket.emit("chat:message", botMsg);
                        session.messages.push(botMsg);
                        
                        // Cũng gửi cho admin để theo dõi
                        io.to("admin-room").emit("admin:message", {
                            sessionId,
                            message: botMsg
                        });
                    }, 500);
                }
            } else {
                // Bot không hiểu -> chuyển cho admin
                session.status = "waiting";
                
                setTimeout(() => {
                    const fallbackMsg = {
                        id: Date.now() + 1,
                        sender: "bot",
                        text: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Đang chuyển cho nhân viên hỗ trợ...",
                        time: new Date()
                    };
                    socket.emit("chat:message", fallbackMsg);
                    session.messages.push(fallbackMsg);
                    
                    // Thông báo admin cần hỗ trợ
                    io.to("admin-room").emit("admin:needSupport", {
                        sessionId,
                        user: session.user
                    });
                }, 500);
            }
        }
        // Nếu status là "admin" hoặc "waiting", không xử lý bot
        // Admin sẽ trả lời qua event admin:message
    });

    // ===================================================
    // PHẦN 2: ADMIN - Xử lý các event từ admin panel
    // ===================================================
    
    /*
     * Event: admin:join
     * Được gọi khi admin mở trang quản lý chat
     * Admin tham gia room "admin-room" để nhận tất cả notifications
     */
    socket.on("admin:join", () => {
        socket.join("admin-room");     // Tham gia room admin
        adminSockets.add(socket.id);   // Đánh dấu admin online
        console.log("👨‍💼 Admin online:", socket.id);
        
        // Gửi danh sách tất cả phiên chat hiện có
        const sessions = Array.from(chatSessions.values()).map(s => ({
            ...s,
            messages: s.messages
        }));
        socket.emit("admin:sessions", sessions);
    });

    /*
     * Event: admin:message
     * Admin gửi tin nhắn cho khách
     */
    socket.on("admin:message", (data) => {
        const { sessionId, text } = data;
        if (!chatSessions.has(sessionId)) return;
        
        const session = chatSessions.get(sessionId);
        session.status = "admin"; // Đánh dấu admin đã tiếp nhận
        session.unread = 0;       // Reset unread
        
        const adminMsg = {
            id: Date.now(),
            sender: "admin",
            text: text,
            time: new Date()
        };
        session.messages.push(adminMsg);
        
        // Gửi tin nhắn đến khách (qua room sessionId)
        io.to(sessionId).emit("chat:message", adminMsg);
        
        // Broadcast cho các admin khác đang xem
        socket.to("admin-room").emit("admin:message", {
            sessionId,
            message: adminMsg
        });
    });

    /*
     * Event: admin:read
     * Admin đã đọc tin nhắn của 1 session -> reset unread
     */
    socket.on("admin:read", (sessionId) => {
        if (chatSessions.has(sessionId)) {
            chatSessions.get(sessionId).unread = 0;
        }
    });

    // ===================================================
    // PHẦN 3: DISCONNECT - Xử lý khi ngắt kết nối
    // ===================================================
    
    /*
     * Event: disconnect
     * Được gọi tự động khi client ngắt kết nối
     * (đóng tab, mất mạng, refresh page...)
     */
    socket.on("disconnect", () => {
        console.log("❌ Ngắt kết nối:", socket.id);
        
        // Nếu là admin, xóa khỏi danh sách online
        adminSockets.delete(socket.id);
        
        // Nếu là khách, đánh dấu session đã disconnect
        if (socket.sessionId && chatSessions.has(socket.sessionId)) {
            const session = chatSessions.get(socket.sessionId);
            session.status = "disconnected";
            
            // Thông báo admin về trạng thái mới
            io.to("admin-room").emit("admin:sessionUpdate", {
                sessionId: socket.sessionId,
                status: "disconnected"
            });
        }
    });
});

// ==========================================
// I. KHỞI ĐỘNG SERVER
// ==========================================
// 
// QUAN TRỌNG: Dùng server.listen() THAY VÌ app.listen()
// Vì Socket.io cần HTTP server để hoạt động
// Nếu dùng app.listen(), Socket.io sẽ KHÔNG hoạt động!

server.listen(port, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
    console.log(`💬 Socket.io đã sẵn sàng cho chat realtime!`);
});