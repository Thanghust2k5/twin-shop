const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const app = express();
const port = process.env.PORT || 3000;

// ==========================================
// 1. CẤU HÌNH CHUNG
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

// Cấu hình Static Files
app.use("/assets", express.static(path.join(__dirname, "../assets")));

// ==========================================
// 2. CẤU HÌNH UPLOAD ẢNH
// ==========================================

// A. Sản phẩm
const productStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, "../assets/img/products/");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const uploadProduct = multer({
    storage: productStorage
});

// B. User Avatar
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
        cb(null, "user-" + Date.now() + path.extname(file.originalname));
    },
});
const uploadUser = multer({
    storage: userStorage
});

// ==========================================
// 3. KẾT NỐI DATABASE
// ==========================================
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "twin_shop",
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) console.error("❌ Lỗi kết nối MySQL:", err);
    else console.log("✅ Đã kết nối thành công với MySQL!");
});

// ==========================================
// K. AUTH API
// ==========================================

app.post("/api/register", (req, res) => {
    const {
        full_name,
        email,
        password
    } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) return res.status(400).json({
            message: "Email này đã được sử dụng!"
        });

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        db.query("INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 0)", [full_name, email, hashedPassword], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({
                message: "Đăng ký thành công!"
            });
        });
    });
});

app.post("/api/login", (req, res) => {
    const {
        email,
        password
    } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length === 0) return res.status(401).json({
            message: "Email không tồn tại!"
        });

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({
            message: "Sai mật khẩu!"
        });

        res.json({
            message: "Đăng nhập thành công",
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                address: user.address,
                avatar: user.avatar,
                phone: user.phone
            },
        });
    });
});

// ==========================================
// C. USER API
// ==========================================

app.get("/api/users/:id", (req, res) => {
    db.query("SELECT id, full_name, email, phone, gender, birthday, avatar, address, role, wallet_balance FROM users WHERE id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json({
            error: "Lỗi Server"
        });
        if (results.length === 0) return res.status(404).json({
            message: "User not found"
        });
        res.json(results[0]);
    });
});

app.get("/api/users", (req, res) => {
    const search = req.query.search || "";
    let sql = "SELECT id, full_name, email, phone, role, address FROM users";
    let params = [];
    if (search) {
        sql += " WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?";
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.put("/api/users/:id", uploadUser.single('avatar'), (req, res) => {
    const userId = req.params.id;
    const updates = req.body;
    if (req.file) updates.avatar = `/assets/img/avatars/${req.file.filename}`;

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

app.get("/api/user-addresses/:userId", (req, res) => {
    db.query("SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC", [req.params.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post("/api/user-addresses", (req, res) => {
    const {
        userId,
        name,
        phone,
        address,
        isDefault
    } = req.body;
    if (isDefault) db.query("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", [userId]);
    db.query("INSERT INTO user_addresses (user_id, recipient_name, recipient_phone, address, is_default) VALUES (?, ?, ?, ?, ?)", [userId, name, phone, address, isDefault ? 1 : 0], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({
            message: "Thêm thành công",
            id: result.insertId
        });
    });
});

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
// D. PRODUCT API
// ==========================================

app.get("/api/products", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const sort = req.query.sort || "newest";
    const categoryId = req.query.categoryId || "";
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    let params = [];

    if (search) {
        whereClause += " AND p.name LIKE ?";
        params.push(`%${search}%`);
    }
    if (categoryId) {
        whereClause += " AND p.category_id = ?";
        params.push(categoryId);
    }

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

    const sqlCount = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
    const sqlData = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;

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

app.get("/api/products/:id", (req, res) => {
    db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, resultProduct) => {
        if (err) return res.status(500).json(err);
        if (resultProduct.length === 0) return res.status(404).json({
            message: "Không tìm thấy"
        });

        const product = resultProduct[0];
        db.query("SELECT image_url FROM product_images WHERE product_id = ?", [product.id], (err, resultImages) => {
            product.images = resultImages.map((img) => img.image_url);
            db.query("SELECT id, color, size, stock FROM product_variants WHERE product_id = ?", [product.id], (err, resultVariants) => {
                product.variants = resultVariants;
                res.json(product);
            });
        });
    });
});

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
// E. CART API
// ==========================================

app.get("/api/cart/:userId", (req, res) => {
    const sql = `SELECT c.id, c.product_id, c.quantity, c.color, c.size, p.name, p.price, p.thumbnail, p.discount_percentage FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`;
    db.query(sql, [req.params.userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post("/api/cart", (req, res) => {
    const {
        userId,
        productId,
        quantity,
        color,
        size
    } = req.body;
    db.query("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND color = ? AND size = ?", [userId, productId, color || "", size || ""], (err, results) => {
        if (results.length > 0) {
            db.query("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?", [quantity, results[0].id], () => res.json({
                message: "Updated"
            }));
        } else {
            db.query("INSERT INTO cart_items (user_id, product_id, quantity, color, size) VALUES (?, ?, ?, ?, ?)", [userId, productId, quantity, color || "", size || ""], () => res.json({
                message: "Added"
            }));
        }
    });
});

app.delete("/api/cart/:userId/:productId", (req, res) => {
    db.query("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", [req.params.userId, req.params.productId], () => res.json({
        message: "Deleted"
    }));
});

app.put("/api/cart/update/:id", (req, res) => {
    const {
        quantity
    } = req.body;
    if (quantity <= 0) {
        db.query("DELETE FROM cart_items WHERE id = ?", [req.params.id], () => res.json({
            message: "Deleted"
        }));
    } else {
        db.query("UPDATE cart_items SET quantity = ? WHERE id = ?", [quantity, req.params.id], () => res.json({
            message: "Updated"
        }));
    }
});

app.post("/api/cart/delete-items", (req, res) => {
    const {
        cartIds
    } = req.body;
    if (!cartIds || cartIds.length === 0) return res.json({
        message: "Nothing to delete"
    });
    db.query(`DELETE FROM cart_items WHERE id IN (?)`, [cartIds], () => res.json({
        message: "Deleted"
    }));
});

// ==========================================
// F. ORDER API
// ==========================================

app.post("/api/orders", (req, res) => {
    const {
        userId,
        recipientName,
        recipientPhone,
        recipientAddress,
        totalMoney,
        items,
        paymentMethod,
        note,
        shippingId
    } = req.body;

    const createOrderProcess = () => {
        db.query("INSERT INTO orders (user_id, recipient_name, recipient_phone, recipient_address, note, total_money, payment_method, shipping_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [userId, recipientName, recipientPhone, recipientAddress, note, totalMoney, paymentMethod, shippingId], (err, result) => {
                if (err) return res.status(500).json({
                    error: "Lỗi tạo đơn"
                });
                const orderId = result.insertId;
                const details = items.map(i => [orderId, i.product_id, i.quantity, i.price, i.color || "", i.size || ""]);

                db.query("INSERT INTO order_details (order_id, product_id, quantity, price_at_time, color, size) VALUES ?", [details], () => {
                    items.forEach(i => {
                        if (i.color && i.size) db.query("UPDATE product_variants SET stock = stock - ? WHERE product_id = ? AND color = ? AND size = ?", [i.quantity, i.product_id, i.color, i.size]);
                        db.query("UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?", [i.quantity, i.quantity, i.product_id]);
                    });
                    const pIds = items.map(i => i.product_id);
                    db.query(`DELETE FROM cart_items WHERE user_id = ? AND product_id IN (?)`, [userId, pIds], () => res.json({
                        message: "Success",
                        orderId
                    }));
                });
            });
    };

    if (paymentMethod === 'TWINPAY') {
        db.query("SELECT wallet_balance FROM users WHERE id = ?", [userId], (err, r) => {
            if (r[0].wallet_balance < totalMoney) return res.status(400).json({
                message: "Không đủ tiền"
            });
            db.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [totalMoney, userId], () => createOrderProcess());
        });
    } else {
        createOrderProcess();
    }
});

app.get("/api/my-orders/:userId", (req, res) => {
    db.query("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC", [req.params.userId], (err, orders) => {
        if (orders.length === 0) return res.json([]);
        const ids = orders.map(o => o.id);
        db.query("SELECT od.*, p.name, p.thumbnail FROM order_details od JOIN products p ON od.product_id = p.id WHERE od.order_id IN (?)", [ids], (err, details) => {
            const result = orders.map(o => ({
                ...o,
                items: details.filter(d => d.order_id === o.id)
            }));
            res.json(result);
        });
    });
});

app.get("/api/orders/:id/details", (req, res) => {
    db.query("SELECT od.*, p.name, p.thumbnail FROM order_details od JOIN products p ON od.product_id = p.id WHERE od.order_id = ?", [req.params.id], (err, r) => res.json(r));
});

app.patch("/api/orders/:id/cancel", (req, res) => {
    db.query("SELECT status FROM orders WHERE id = ?", [req.params.id], (err, r) => {
        if (r[0].status === "pending") {
            db.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [req.params.id], () => res.json({
                message: "Đã hủy"
            }));
        } else {
            res.status(400).json({
                message: "Không thể hủy"
            });
        }
    });
});

app.get("/api/admin/orders", (req, res) => {
    const search = req.query.search || "";
    const status = req.query.status || "";
    let sql = "SELECT * FROM orders WHERE 1=1";
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

app.patch("/api/admin/orders/:id", (req, res) => {
    db.query("UPDATE orders SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => res.json({
        message: "Updated"
    }));
});

// ==========================================
// G. REVIEWS & CONFIG API
// ==========================================

app.get("/api/admin/reviews", (req, res) => {
    db.query("SELECT r.*, u.full_name, p.name as product_name FROM reviews r JOIN users u ON r.user_id = u.id JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC", (e, r) => res.json(r));
});

app.post("/api/reviews", (req, res) => {
    const {
        userId,
        productId,
        rating,
        comment
    } = req.body;
    db.query("INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)", [userId, productId, rating, comment], () => {
        db.query("SELECT AVG(rating) as avgRating FROM reviews WHERE product_id = ?", [productId], (e, r) => {
            db.query("UPDATE products SET rating = ? WHERE id = ?", [r[0].avgRating || 5, productId]);
        });
        res.json({
            message: "Success"
        });
    });
});

app.delete("/api/admin/reviews/:id", (req, res) => {
    db.query("DELETE FROM reviews WHERE id = ?", [req.params.id], () => res.json({
        message: "Deleted"
    }));
});

app.get("/api/products/:id/reviews", (req, res) => {
    const {
        page = 1, limit = 5, rating
    } = req.query;
    const offset = (page - 1) * limit;
    let where = "WHERE product_id = ?";
    let params = [req.params.id];
    if (rating && rating !== 'all') {
        where += " AND rating = ?";
        params.push(rating);
    }

    const sqlData = `SELECT r.*, u.full_name, u.avatar FROM reviews r JOIN users u ON r.user_id = u.id ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    const sqlCount = `SELECT COUNT(*) as total FROM reviews ${where}`;
    const sqlStats = `SELECT rating, COUNT(*) as count FROM reviews WHERE product_id = ? GROUP BY rating`;

    db.query(sqlData, [...params, parseInt(limit), offset], (e, reviews) => {
        db.query(sqlCount, params, (e, c) => {
            db.query(sqlStats, [req.params.id], (e, s) => {
                const stats = {
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    all: 0
                };
                s.forEach(i => {
                    stats[i.rating] = i.count;
                    stats.all += i.count;
                });
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

// CATEGORIES
app.get("/api/categories", (req, res) => {
    db.query("SELECT * FROM categories", (e, r) => res.json(r));
});
app.get("/api/categories/:id", (req, res) => {
    db.query("SELECT * FROM categories WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});
app.post("/api/categories", (req, res) => {
    db.query("INSERT INTO categories (name, description) VALUES (?,?)", [req.body.name, req.body.description], () => res.json({
        message: "OK"
    }));
});
app.put("/api/categories/:id", (req, res) => {
    db.query("UPDATE categories SET name=?, description=? WHERE id=?", [req.body.name, req.body.description, req.params.id], () => res.json({
        message: "OK"
    }));
});
app.delete("/api/categories/:id", (req, res) => {
    db.query("DELETE FROM categories WHERE id=?", [req.params.id], () => res.json({
        message: "Deleted"
    }));
});

// SHIPPING
app.get("/api/shipping", (req, res) => {
    db.query("SELECT * FROM shipping_methods", (e, r) => res.json(r));
});
app.get("/api/shipping/:id", (req, res) => {
    db.query("SELECT * FROM shipping_methods WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});
app.post("/api/shipping", (req, res) => {
    db.query("INSERT INTO shipping_methods (name, price) VALUES (?,?)", [req.body.name, req.body.price], () => res.json({
        message: "OK"
    }));
});
app.put("/api/shipping/:id", (req, res) => {
    db.query("UPDATE shipping_methods SET name=?, price=? WHERE id=?", [req.body.name, req.body.price, req.params.id], () => res.json({
        message: "OK"
    }));
});
app.delete("/api/shipping/:id", (req, res) => {
    db.query("DELETE FROM shipping_methods WHERE id=?", [req.params.id], () => res.json({
        message: "Deleted"
    }));
});

// PAYMENT
app.get("/api/payment", (req, res) => {
    db.query("SELECT * FROM payment_methods", (e, r) => res.json(r));
});
app.get("/api/payment/:id", (req, res) => {
    db.query("SELECT * FROM payment_methods WHERE id=?", [req.params.id], (e, r) => res.json(r[0]));
});
app.post("/api/payment", (req, res) => {
    db.query("INSERT INTO payment_methods (name, code) VALUES (?,?)", [req.body.name, req.body.code], () => res.json({
        message: "OK"
    }));
});
app.put("/api/payment/:id", (req, res) => {
    db.query("UPDATE payment_methods SET name=?, code=? WHERE id=?", [req.body.name, req.body.code, req.params.id], () => res.json({
        message: "OK"
    }));
});
app.delete("/api/payment/:id", (req, res) => {
    db.query("DELETE FROM payment_methods WHERE id=?", [req.params.id], () => res.json({
        message: "Deleted"
    }));
});

// STATS
app.get("/api/admin/stats", (req, res) => {
    const q = {
        p: "SELECT COUNT(*) c FROM products",
        o: "SELECT COUNT(*) c FROM orders",
        u: "SELECT COUNT(*) c FROM users",
        r: "SELECT SUM(total_money) t FROM orders WHERE status='completed'"
    };
    Promise.all([
        new Promise(r => db.query(q.p, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.o, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.u, (e, res) => r(res[0].c))),
        new Promise(r => db.query(q.r, (e, res) => r(res[0].t || 0)))
    ]).then(([products, orders, users, revenue]) => res.json({
        products,
        orders,
        users,
        revenue
    }));
});

app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
});