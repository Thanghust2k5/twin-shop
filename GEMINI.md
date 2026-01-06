# GEMINI.md - Thang Shop

## Tổng Quan Dự Án

Đây là ứng dụng web thương mại điện tử fullstack có tên **"Thang Shop"**.
Website được xây dựng với kiến trúc truyền thống: Frontend dùng HTML, CSS, JavaScript thuần và Backend dùng Node.js.

### 🎨 Frontend (Giao diện người dùng)

*   **Các trang HTML:** `index.html` (trang chủ), `cart.html` (giỏ hàng), `checkout.html` (thanh toán), `product-detail.html` (chi tiết sản phẩm), `user.html` (tài khoản), `admin.html` (quản trị)
*   **CSS:** Styling cho website, responsive cho mobile
*   **JavaScript:** Xử lý tương tác người dùng, gọi API đến backend
*   **Thư mục:** `assets/css/`, `assets/js/`, `assets/img/`, `components/`

### ⚙️ Backend (Server xử lý dữ liệu)

*   **Framework:** Node.js + Express.js
*   **API:** RESTful API quản lý users, products, orders, carts, categories, reviews, ...
*   **Realtime:** Socket.io cho hệ thống chat giữa khách hàng và admin
*   **Upload:** Xử lý upload ảnh sản phẩm và avatar người dùng
*   **Thư mục:** `server/server.js`

### 🗄️ Database (Cơ sở dữ liệu)

*   **Hệ quản trị:** MySQL trên Aiven Cloud
*   **Host:** `twin-shop-db-t-winshop.i.aivencloud.com:27859`
*   **Database:** `twin_shop`
*   **Seed data:** `server/seed.js`, `server/seed-reviews.js`

### 🚀 Deployment (Triển khai)

*   **Hosting:** Render.com (Web Service)
*   **URL:** https://thang-shop.onrender.com
*   **Database:** Aiven MySQL (Cloud database miễn phí)

---

## Cấu Trúc Thư Mục

```
thang-shop/
├── 📄 HTML Pages (Các trang)
│   ├── index.html          # Trang chủ - Danh sách sản phẩm
│   ├── cart.html           # Giỏ hàng
│   ├── checkout.html       # Thanh toán
│   ├── product-detail.html # Chi tiết sản phẩm
│   ├── user.html           # Tài khoản người dùng
│   └── admin.html          # Trang quản trị
│
├── 📁 assets/              # Tài nguyên tĩnh
│   ├── css/                # File CSS styling
│   ├── js/                 # File JavaScript logic
│   ├── img/                # Hình ảnh (products, avatars)
│   └── fonts/              # Font icons (FontAwesome)
│
├── 📁 components/          # Component HTML dùng chung
│   ├── header.html         # Header navigation
│   └── footer.html         # Footer
│
├── 📁 server/              # Backend
│   ├── server.js           # Express server + API + Socket.io
│   ├── seed.js             # Seed data sản phẩm/danh mục
│   └── seed-reviews.js     # Seed data đánh giá
│
├── package.json            # Cấu hình npm dependencies
└── GEMINI.md               # File tài liệu này
```

---

## Hướng Dẫn Chạy Dự Án

### 1. Cài đặt Dependencies

Cài đặt các package Node.js cần thiết:

```sh
npm install
```

### 2. Cấu hình Database

Tạo file `.env` hoặc set environment variables:

```sh
DB_HOST=twin-shop-db-t-winshop.i.aivencloud.com
DB_PORT=27859
DB_USER=avnadmin
DB_PASSWORD=<password>
DB_NAME=twin_shop
```

### 3. Chạy Server

Khởi động server (mặc định chạy ở cổng 3000):

```sh
npm start
# hoặc
node server/server.js
```

### 4. Truy cập Website

Mở trình duyệt và truy cập:
- **Local:** http://localhost:3000
- **Production:** https://thang-shop.onrender.com

---

## Quy Ước Phát Triển

### API Endpoints

*   **Users:** `/api/users`, `/api/login`, `/api/register`
*   **Products:** `/api/products`, `/api/products/:id`
*   **Categories:** `/api/categories`
*   **Cart:** `/api/cart/:userId`
*   **Orders:** `/api/orders`
*   **Reviews:** `/api/reviews`
*   **Upload:** `/api/upload`

### Static Files

Tất cả file frontend (HTML, CSS, JS, images) được serve từ thư mục gốc dự án.

### Socket.io Events

*   `chat-message`: Gửi tin nhắn chat
*   `join-room`: Tham gia phòng chat
*   `admin-join`: Admin tham gia phòng chat

### Dependencies

*   **express:** Web framework
*   **mysql2:** MySQL driver
*   **socket.io:** Realtime communication
*   **multer:** File upload handling
*   **cors:** Cross-origin resource sharing
*   **dotenv:** Environment variables
