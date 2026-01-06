// =========================================================
// FILE: assets/js/admin.js
// =========================================================
//
// MỤC ĐÍCH: Quản lý trang Admin Panel của shop
// File này xử lý toàn bộ chức năng quản trị:
//   - Dashboard: Thống kê, biểu đồ doanh thu
//   - Sản phẩm: CRUD (Thêm, Xem, Sửa, Xóa)
//   - Đơn hàng: Xem, duyệt, cập nhật trạng thái
//   - Người dùng: Xem danh sách
//   - Đánh giá: Quản lý reviews
//   - Danh mục, Vận chuyển, Thanh toán: Cấu hình hệ thống
//
// CẤU TRÚC FILE:
//   1. Biến toàn cục & Hàm tiện ích (formatMoney, closeModal, switchTab)
//   2. Products - Quản lý sản phẩm (CRUD với search, sort, pagination)
//   3. Orders - Quản lý đơn hàng (filter theo status, duyệt đơn)
//   4. Users - Xem danh sách người dùng
//   5. Reviews - Quản lý đánh giá
//   6. Categories, Shipping, Payment - Cấu hình hệ thống
//   7. Dashboard - Thống kê và biểu đồ (Chart.js)
//   8. View Detail - Modal xem chi tiết sản phẩm/đơn hàng
//   9. Khởi chạy (DOMContentLoaded)
// =========================================================

// =========================================================
// PHẦN 1: BIẾN TOÀN CỤC & HÀM TIỆN ÍCH
// =========================================================

// ---- API URL ----
// Đường dẫn gốc của API (tương đối với domain hiện tại)
const apiUrl = "/api";

// ---- BIẾN LƯU CHART INSTANCES ----
// Chart.js yêu cầu lưu instance để destroy trước khi tạo mới
// Tránh lỗi khi reload data nhiều lần
let revenueChartInstance = null; // Biểu đồ doanh thu (bar chart)
let pieChartInstance = null;     // Biểu đồ trạng thái đơn (pie chart)

// ---- HÀM FORMAT TIỀN VIỆT NAM ----
// Chuyển số thành chuỗi tiền tệ VNĐ đẹp
// VD: 100000 -> "100.000 ₫"
function formatMoney(n) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(n || 0);
}

// ---- HÀM ĐÓNG MODAL ----
// Đóng bất kỳ modal nào dựa trên ID
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

// ---- HÀM CHUYỂN TAB (SPA) ----
// Admin Panel hoạt động như SPA - không reload trang khi chuyển tab
// Params:
//   - tab: Tên tab (dashboard, products, orders, users, ...)
//   - el: Element menu được click (để thêm class active)
function switchTab(tab, el) {
    // ---- LƯU TAB HIỆN TẠI VÀO LOCALSTORAGE ----
    // Để giữ tab khi user F5 refresh trang
    localStorage.setItem("currentAdminTab", tab);
    
    // Nếu không có el (gọi từ code), tìm menu item tương ứng
    if (!el) {
        el = document.querySelector(`.menu-item[onclick*="'${tab}'"]`);
    }

    // ---- 1. ACTIVE MENU SIDEBAR ----
    if (el) {
        // Bỏ active khỏi tất cả menu items
        document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
        
        // Thêm active vào menu được chọn
        el.classList.add("active");
        
        // Cập nhật tiêu đề trang
        document.getElementById("page-title").innerText = el.innerText;
    }

    // ---- 2. ACTIVE NỘI DUNG TAB ----
    // Ẩn tất cả sections
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    
    // Hiện section tương ứng với tab
    const target = document.getElementById("tab-" + tab);
    if (target) target.classList.add("active");

    // ---- 3. LOAD DATA CHO TAB ----
    // Mỗi tab có hàm load riêng để fetch data từ API
    switch (tab) {
        case "dashboard": loadDashboard(); break;
        case "products": loadProducts(1); break;
        case "orders": loadOrders(); break;
        case "users": loadUsers(); break;
        case "reviews": loadReviews(); break;
        case "categories": loadCategories(); break;
        case "shipping": loadShipping(); break;
        case "payment": loadPayment(); break;
        case "chat": /* AdminChat handles this - xử lý ở admin-chat.js */ break;
    }
}
// =========================================================
// PHẦN 2: QUẢN LÝ SẢN PHẨM (PRODUCTS)
// =========================================================
// Bao gồm: Search, Sort, Pagination, CRUD (Create, Read, Update, Delete)

// ---- HÀM TẢI DANH SÁCH SẢN PHẨM ----
// Params:
//   - page: Số trang cần load (mặc định = 1)
function loadProducts(page = 1) {
    // ---- LẤY GIÁ TRỊ TỪ CÁC INPUT FILTER ----
    const search = document.getElementById("prod-search").value; // Từ khóa tìm kiếm
    const sort = document.getElementById("prod-sort").value;     // Cách sắp xếp

    // ---- GỌI API LẤY SẢN PHẨM ----
    // GET /api/products?page=1&limit=10&search=xxx&sort=price_asc
    fetch(`${apiUrl}/products?page=${page}&limit=10&search=${search}&sort=${sort}`)
        .then(r => r.json())
        .then(d => {
            // ---- RENDER BẢNG SẢN PHẨM ----
            // d.data: Mảng sản phẩm
            document.getElementById("product-list").innerHTML = d.data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.thumbnail}" style="width:40px;height:40px;object-fit:cover"></td>
                    <td>${p.name}</td>
                    <td style="color:#ee4d2d;font-weight:bold">${formatMoney(p.price)}</td>
                    <td>${p.stock}</td>
                    <td>
                        <!-- Các nút action: Xem, Sửa, Xóa -->
                        <button class="btn btn-view" onclick="viewDetail('product', ${p.id})">Xem</button>
                        <button class="btn btn-edit" onclick="openProductModal('edit', ${p.id})">Sửa</button>
                        <button class="btn btn-delete" onclick="deleteItem('products', ${p.id})">Xóa</button>
                    </td>
                </tr>
            `).join("");

            // ---- RENDER PAGINATION ----
            const totalPages = d.pagination.totalPages;
            let paginationHtml = '';

            if (totalPages > 1) {
                // ---- TẠO MẢNG CÁC TRANG CẦN HIỂN THỊ ----
                // Thuật toán: Hiển thị trang đầu, cuối, và các trang xung quanh trang hiện tại
                const range = [];
                const delta = 2; // Số trang hiển thị 2 bên trang hiện tại

                for (let i = 1; i <= totalPages; i++) {
                    // Thêm nếu: trang đầu, trang cuối, hoặc trong khoảng delta
                    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
                        range.push(i);
                    }
                }

                // ---- TẠO HTML PAGINATION ----
                let l; // Trang trước đó (dùng để check có cần ... không)
                for (let i of range) {
                    if (l) {
                        if (i - l === 2) {
                            // Chỉ thiếu 1 trang -> hiển thị trang đó thay vì ...
                            paginationHtml += `<button onclick="loadProducts(${l + 1})">${l + 1}</button>`;
                        } else if (i - l !== 1) {
                            // Thiếu nhiều hơn 1 trang -> hiển thị ...
                            paginationHtml += `<span class="dots">...</span>`;
                        }
                    }
                    // Button trang hiện tại (có class active)
                    paginationHtml += `<button class="${i === page ? 'active' : ''}" onclick="loadProducts(${i})">${i}</button>`;
                    l = i;
                }

                // Nút Next (nếu chưa phải trang cuối)
                if (page < totalPages) {
                    paginationHtml += `<button onclick="loadProducts(${page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
                }
            }

            document.getElementById("product-pagination").innerHTML = paginationHtml;
        });

    // ---- LOAD DANH MỤC CHO SELECT BOX ----
    // Dùng trong form thêm/sửa sản phẩm
    fetch(`${apiUrl}/categories`).then(r => r.json()).then(cats => {
        const select = document.getElementById("p-category");
        // Chỉ load nếu chưa có options (tránh trùng lặp)
        if (select.options.length === 0) {
            select.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
        }
    });
}

// ---- HÀM MỞ MODAL THÊM/SỬA SẢN PHẨM ----
// Params:
//   - mode: 'add' (thêm mới) hoặc 'edit' (sửa)
//   - id: ID sản phẩm (chỉ cần khi mode = 'edit')
function openProductModal(mode, id) {
    const form = document.getElementById("form-product");
    
    if (mode === "add") {
        // ---- CHẾ ĐỘ THÊM MỚI ----
        form.reset(); // Xóa toàn bộ form
        document.getElementById("p-id").value = ""; // Xóa ID
        document.getElementById("modal-product-title").innerText = "Thêm Sản Phẩm";
    } else {
        // ---- CHẾ ĐỘ SỬA ----
        document.getElementById("modal-product-title").innerText = "Sửa Sản Phẩm #" + id;
        
        // Fetch thông tin sản phẩm và điền vào form
        fetch(`${apiUrl}/products/${id}`).then(r => r.json()).then(p => {
            document.getElementById("p-id").value = p.id;
            document.getElementById("p-name").value = p.name;
            document.getElementById("p-price").value = p.price;
            document.getElementById("p-stock").value = p.stock;
            document.getElementById("p-category").value = p.category_id;
            document.getElementById("p-desc").value = p.description;
        });
    }
    
    // Hiển thị modal
    document.getElementById("modal-product").style.display = "flex";
}

// ---- XỬ LÝ SUBMIT FORM SẢN PHẨM ----
// Lắng nghe sự kiện submit trên form
document.getElementById("form-product").addEventListener("submit", function(e) {
    // Ngăn form submit mặc định (reload trang)
    e.preventDefault();
    
    // ---- LẤY CÁC INPUT CẦN VALIDATE ----
    const nameInput = document.getElementById("p-name");
    const priceInput = document.getElementById("p-price");
    const stockInput = document.getElementById("p-stock");
    
    // ---- VALIDATE DỮ LIỆU ----
    // Sử dụng Validator từ validation.js
    let isValid = true;
    
    // ---- Validate tên sản phẩm ----
    const nameResult = Validator.validateProductName(nameInput.value);
    if (!nameResult.isValid) {
        Validator.showError(nameInput, nameResult.message);
        isValid = false;
    } else {
        Validator.clearError(nameInput);
    }
    
    // ---- Validate giá ----
    const priceResult = Validator.validatePrice(priceInput.value);
    if (!priceResult.isValid) {
        Validator.showError(priceInput, priceResult.message);
        isValid = false;
    } else {
        Validator.clearError(priceInput);
    }
    
    // ---- Validate số lượng tồn kho ----
    const stockResult = Validator.validateQuantity(stockInput.value);
    if (!stockResult.isValid) {
        Validator.showError(stockInput, stockResult.message);
        isValid = false;
    } else {
        Validator.clearError(stockInput);
    }
    
    // Nếu có lỗi validate -> dừng lại, không submit
    if (!isValid) return;
    
    // ---- CHUẨN BỊ DỮ LIỆU GỬI LÊN SERVER ----
    const id = document.getElementById("p-id").value; // ID sản phẩm (có nếu đang sửa)
    
    // Dùng FormData vì có upload file (thumbnail, images)
    const formData = new FormData();
    formData.append("name", nameInput.value);
    formData.append("price", priceInput.value);
    formData.append("stock", stockInput.value);
    formData.append("category_id", document.getElementById("p-category").value);
    formData.append("description", document.getElementById("p-desc").value);

    // ---- UPLOAD FILE ẢNH ----
    // Thumbnail: Ảnh chính của sản phẩm
    const thumb = document.getElementById("p-thumbnail").files[0];
    if (thumb) formData.append("thumbnail", thumb);
    
    // Images: Các ảnh phụ (gallery)
    const imgs = document.getElementById("p-images").files;
    for (let i = 0; i < imgs.length; i++) {
        formData.append("images", imgs[i]);
    }

    // ---- XÁC ĐỊNH METHOD VÀ URL ----
    // Nếu có ID -> PUT (sửa), không có ID -> POST (thêm mới)
    const method = id ? "PUT" : "POST";
    const url = id ? `${apiUrl}/products/${id}` : `${apiUrl}/products`;

    // ---- GỌI API ----
    fetch(url, {
        method: method,
        body: formData // Không cần set Content-Type, browser tự set multipart/form-data
    }).then(() => {
        alert("Thành công!");
        closeModal("modal-product");
        loadProducts(); // Reload danh sách sản phẩm
    });
});

// =========================================================
// PHẦN 3: QUẢN LÝ ĐƠN HÀNG (ORDERS)
// =========================================================
// Bao gồm: Xem danh sách, filter theo status, duyệt đơn

// ---- HÀM TẢI DANH SÁCH ĐƠN HÀNG ----
function loadOrders() {
    // Lấy giá trị filter từ các input
    const search = document.getElementById("order-search").value;  // Tìm theo tên/SĐT
    const status = document.getElementById("order-status").value;  // Filter theo trạng thái

    // ---- GỌI API LẤY ĐƠN HÀNG ----
    // GET /api/admin/orders?search=xxx&status=pending
    fetch(`${apiUrl}/admin/orders?search=${search}&status=${status}`)
        .then(r => r.json())
        .then(orders => {
            // ---- RENDER BẢNG ĐƠN HÀNG ----
            document.getElementById("order-list").innerHTML = orders.map(o => `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.recipient_name}</td>
                    <td>${new Date(o.order_date).toLocaleDateString("vi-VN")}</td>
                    <td style="color:#ee4d2d;font-weight:bold">${formatMoney(o.total_money)}</td>
                    <td><span class="badge bg-${o.status}">${o.status}</span></td>
                    <td>
                        <!-- Nút Xem chi tiết (luôn có) -->
                        <button class="btn btn-view" onclick="viewDetail('order', ${o.id})">Xem</button>
                        
                        <!-- Nút Duyệt: Chỉ hiện khi status = pending -->
                        ${o.status === "pending" ? `<button class="btn btn-add" onclick="updateOrderStatus(${o.id}, 'shipping')">Duyệt</button>` : ""}
                        
                        <!-- Nút Xong: Chỉ hiện khi status = shipping -->
                        ${o.status === "shipping" ? `<button class="btn btn-add" style="background:#28a745" onclick="updateOrderStatus(${o.id}, 'completed')">Xong</button>` : ""}
                    </td>
                </tr>
            `).join("");
        });
}

// ---- HÀM CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG ----
// Dùng khi admin duyệt đơn hoặc xác nhận hoàn thành
// Params:
//   - id: ID đơn hàng
//   - status: Trạng thái mới ('shipping', 'completed')
function updateOrderStatus(id, status) {
    if (confirm("Cập nhật trạng thái đơn hàng này?")) {
        // PATCH /api/admin/orders/{id}
        fetch(`${apiUrl}/admin/orders/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status // Shorthand: { status: status }
            })
        }).then(() => {
            loadOrders(); // Reload danh sách để cập nhật UI
        });
    }
}

// =========================================================
// PHẦN 4: QUẢN LÝ NGƯỜI DÙNG (USERS)
// =========================================================

// ---- HÀM TẢI DANH SÁCH NGƯỜI DÙNG ----
function loadUsers() {
    const search = document.getElementById("user-search").value;
    
    // GET /api/users?search=xxx
    fetch(`${apiUrl}/users?search=${search}`).then(r => r.json()).then(users => {
        // Render bảng users
        document.getElementById("user-list").innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.full_name}</td>
                <td>${u.email}</td>
                <td>${u.phone || "Chưa có"}</td>
                <!-- Role: 1 = Admin, 0 = Khách hàng -->
                <td>${u.role === 1 ? "Admin" : "Khách"}</td>
            </tr>
        `).join("");
    });
}

// =========================================================
// PHẦN 5: QUẢN LÝ ĐÁNH GIÁ (REVIEWS)
// =========================================================

// ---- HÀM TẢI DANH SÁCH ĐÁNH GIÁ ----
function loadReviews() {
    // GET /api/admin/reviews
    fetch(`${apiUrl}/admin/reviews`).then(r => r.json()).then(reviews => {
        document.getElementById("review-list").innerHTML = reviews.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>${r.full_name}</td>
                <td>${r.product_name}</td>
                <!-- Số sao: Lặp ký tự ★ theo rating -->
                <td style="color:#fadb14">${"★".repeat(r.rating)}</td>
                <td>${r.comment}</td>
                <td><button class="btn btn-delete" onclick="deleteItem('admin/reviews', ${r.id})">Xóa</button></td>
            </tr>
        `).join("");
    });
}

// =========================================================
// PHẦN 6: CẤU HÌNH HỆ THỐNG (CATEGORIES, SHIPPING, PAYMENT)
// =========================================================
// 3 loại này có cấu trúc tương tự nên dùng chung form "simple"

// ---- HÀM TẢI DANH MỤC SẢN PHẨM ----
function loadCategories() {
    fetch(`${apiUrl}/categories`).then(r => r.json()).then(d => {
        document.getElementById("category-list").innerHTML = d.map(x => `
            <tr>
                <td>${x.id}</td>
                <td>${x.name}</td>
                <td>${x.description}</td>
                <td>
                    <button class="btn btn-edit" onclick="openSimpleModal('category','edit',${x.id})">Sửa</button>
                    <button class="btn btn-delete" onclick="deleteItem('categories',${x.id})">Xóa</button>
                </td>
            </tr>`).join("");
    });
}

// ---- HÀM TẢI PHƯƠNG THỨC VẬN CHUYỂN ----
function loadShipping() {
    fetch(`${apiUrl}/shipping`).then(r => r.json()).then(d => {
        document.getElementById("shipping-list").innerHTML = d.map(x => `
            <tr>
                <td>${x.id}</td>
                <td>${x.name}</td>
                <td>${formatMoney(x.price)}</td>
                <td>
                    <button class="btn btn-edit" onclick="openSimpleModal('shipping','edit',${x.id})">Sửa</button>
                    <button class="btn btn-delete" onclick="deleteItem('shipping',${x.id})">Xóa</button>
                </td>
            </tr>`).join("");
    });
}

// ---- HÀM TẢI PHƯƠNG THỨC THANH TOÁN ----
function loadPayment() {
    fetch(`${apiUrl}/payment`).then(r => r.json()).then(d => {
        document.getElementById("payment-list").innerHTML = d.map(x => `
            <tr>
                <td>${x.id}</td>
                <td>${x.name}</td>
                <td>${x.code}</td>
                <td>
                    <button class="btn btn-edit" onclick="openSimpleModal('payment','edit',${x.id})">Sửa</button>
                    <button class="btn btn-delete" onclick="deleteItem('payment',${x.id})">Xóa</button>
                </td>
            </tr>`).join("");
    });
}

// ---- HÀM MỞ MODAL THÊM/SỬA (DÙNG CHUNG CHO 3 LOẠI) ----
// Params:
//   - type: 'category', 'shipping', 'payment'
//   - mode: 'add' hoặc 'edit'
//   - id: ID của item (chỉ cần khi edit)
function openSimpleModal(type, mode, id = null) {
    // Reset form
    document.getElementById("form-simple").reset();
    document.getElementById("simple-type").value = type;  // Lưu loại vào hidden input
    document.getElementById("simple-id").value = id || ""; // Lưu ID vào hidden input

    // ---- CẤU HÌNH LABELS THEO LOẠI ----
    const lbl1 = document.getElementById("lbl-1");
    const lbl2 = document.getElementById("lbl-2");
    const inp2 = document.getElementById("inp-2");

    if (type === "category") {
        lbl1.innerText = "Tên danh mục";
        lbl2.innerText = "Mô tả";
        inp2.type = "text";
    } else if (type === "shipping") {
        lbl1.innerText = "Tên phương thức";
        lbl2.innerText = "Giá (VNĐ)";
        inp2.type = "number";
    } else if (type === "payment") {
        lbl1.innerText = "Tên phương thức";
        lbl2.innerText = "Mã code";
        inp2.type = "text";
    }

    // ---- XỬ LÝ CHẾ ĐỘ SỬA ----
    if (mode === "edit") {
        document.getElementById("simple-title").innerText = "Sửa Thông Tin";
        
        // Xác định URL API dựa trên type
        let url = type === "category" ? `${apiUrl}/categories/${id}` 
                : type === "shipping" ? `${apiUrl}/shipping/${id}` 
                : `${apiUrl}/payment/${id}`;
        
        // Fetch data và điền vào form
        fetch(url).then(r => r.json()).then(d => {
            document.getElementById("inp-1").value = d.name;
            // Input 2 khác nhau tùy type: description, price, hoặc code
            document.getElementById("inp-2").value = (type === "category") ? d.description 
                                                    : (type === "shipping") ? d.price 
                                                    : d.code;
        });
    } else {
        document.getElementById("simple-title").innerText = "Thêm Mới";
    }
    
    // Hiển thị modal
    document.getElementById("modal-simple").style.display = "flex";
}

// ---- XỬ LÝ SUBMIT FORM SIMPLE ----
document.getElementById("form-simple").addEventListener("submit", function(e) {
    e.preventDefault();
    
    // Lấy thông tin từ hidden inputs
    const type = document.getElementById("simple-type").value;
    const id = document.getElementById("simple-id").value;
    
    // Lấy giá trị từ form
    const val1 = document.getElementById("inp-1").value;
    const val2 = document.getElementById("inp-2").value;

    // ---- TẠO BODY REQUEST TÙY LOẠI ----
    let body = {};
    if (type === "category") {
        body = { name: val1, description: val2 };
    } else if (type === "shipping") {
        body = { name: val1, price: val2 };
    } else {
        body = { name: val1, code: val2 };
    }

    // ---- XÁC ĐỊNH URL VÀ METHOD ----
    let url = type === "category" ? `${apiUrl}/categories` 
            : type === "shipping" ? `${apiUrl}/shipping` 
            : `${apiUrl}/payment`;
    
    let method = id ? "PUT" : "POST"; // Có ID -> sửa, không -> thêm
    if (id) url += `/${id}`;

    // ---- GỌI API ----
    fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
        .then(() => {
            closeModal("modal-simple");
            // Reload data tương ứng
            if (type === "category") loadCategories();
            if (type === "shipping") loadShipping();
            if (type === "payment") loadPayment();
        });
});

// =========================================================
// PHẦN 7: DASHBOARD & XÓA DỮ LIỆU
// =========================================================
// Dashboard hiển thị thống kê tổng quan và biểu đồ

// ---- HÀM TẢI DASHBOARD ----
function loadDashboard() {
    // ---- LOAD THỐNG KÊ TỔNG QUAN ----
    // GET /api/admin/stats - Trả về: { products, orders, users, revenue }
    fetch(`${apiUrl}/admin/stats`).then(r => r.json()).then(d => {
        // Cập nhật các thẻ thống kê
        document.getElementById("stat-products").innerText = d.products;
        document.getElementById("stat-orders").innerText = d.orders;
        document.getElementById("stat-users").innerText = d.users;
        document.getElementById("stat-revenue").innerText = formatMoney(d.revenue);
    });
    
    // ---- LOAD ĐƠN HÀNG GẦN ĐÂY ----
    fetch(`${apiUrl}/admin/orders`).then(r => r.json()).then(orders => {
        if (Array.isArray(orders)) {
            // Hiển thị 5 đơn hàng gần nhất
            document.getElementById("dash-orders").innerHTML = orders.slice(0, 5).map(o => 
                `<tr>
                    <td>#${o.id}</td>
                    <td>${o.recipient_name}</td>
                    <td>${formatMoney(o.total_money)}</td>
                    <td><span class="badge bg-${o.status}">${o.status}</span></td>
                </tr>`
            ).join("");
            
            // Vẽ biểu đồ từ data đơn hàng
            processCharts(orders);
        }
    });
    
    // ---- LOAD SẢN PHẨM SẮP HẾT HÀNG ----
    fetch(`${apiUrl}/products`).then(r => r.json()).then(d => {
        if (Array.isArray(d.data)) {
            // Lọc sản phẩm có stock < 10 và lấy 5 cái đầu
            document.getElementById("dash-low-stock").innerHTML = d.data
                .filter(p => p.stock < 10)
                .slice(0, 5)
                .map(p => 
                    `<tr>
                        <td><img src="${p.thumbnail}"></td>
                        <td>${p.name}</td>
                        <td style="color:red">${p.stock}</td>
                    </tr>`
                ).join("");
        }
    });
}

// ---- HÀM VẼ BIỂU ĐỒ (CHART.JS) ----
// Vẽ 2 biểu đồ: Doanh thu 7 ngày (Bar) và Tỷ lệ trạng thái đơn (Pie)
function processCharts(orders) {
    // ---- CHUẨN BỊ DỮ LIỆU CHO BIỂU ĐỒ DOANH THU ----
    const last7Days = [];    // Labels (ngày/tháng)
    const revenueData = [];  // Dữ liệu doanh thu
    const today = new Date();
    
    // Duyệt 7 ngày gần nhất (từ 6 ngày trước đến hôm nay)
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        
        // Thêm label ngày/tháng
        last7Days.push(`${d.getDate()}/${d.getMonth() + 1}`);
        
        // Tính tổng doanh thu của ngày đó
        const dateCheck = d.toDateString();
        const total = orders.reduce((sum, o) => {
            const oDate = new Date(o.order_date);
            // Chỉ tính đơn không bị hủy và có cùng ngày
            return oDate.toDateString() === dateCheck && o.status !== "cancelled" 
                   ? sum + Number(o.total_money) 
                   : sum;
        }, 0);
        revenueData.push(total);
    }
    
    // ---- CHUẨN BỊ DỮ LIỆU CHO BIỂU ĐỒ TRẠNG THÁI ----
    const statusCounts = {
        pending: 0,   // Chờ xác nhận
        shipping: 0,  // Đang giao
        completed: 0, // Hoàn thành
        cancelled: 0  // Đã hủy
    };
    
    // Đếm số đơn theo từng trạng thái
    orders.forEach((o) => {
        if (statusCounts[o.status] !== undefined) {
            statusCounts[o.status]++;
        }
    });

    // ---- VẼ BIỂU ĐỒ DOANH THU (BAR CHART) ----
    // Phải destroy chart cũ trước khi tạo mới (yêu cầu của Chart.js)
    if (revenueChartInstance) revenueChartInstance.destroy();
    
    revenueChartInstance = new Chart(document.getElementById("revenueChart"), {
        type: "bar",  // Loại biểu đồ cột
        data: {
            labels: last7Days,  // Trục X: ngày/tháng
            datasets: [{
                label: "Doanh thu",
                data: revenueData,        // Trục Y: doanh thu
                backgroundColor: "#ee4d2d" // Màu cột
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // ---- VẼ BIỂU ĐỒ TRẠNG THÁI (DOUGHNUT/PIE CHART) ----
    if (pieChartInstance) pieChartInstance.destroy();
    
    pieChartInstance = new Chart(document.getElementById("pieChart"), {
        type: "doughnut",  // Loại biểu đồ tròn
        data: {
            labels: ["Chờ", "Giao", "Xong", "Hủy"],
            datasets: [{
                data: [
                    statusCounts.pending, 
                    statusCounts.shipping, 
                    statusCounts.completed, 
                    statusCounts.cancelled
                ],
                // Màu cho từng phần: cam, xanh dương, xanh lá, đỏ
                backgroundColor: ["#fa8c16", "#1890ff", "#52c41a", "#f5222d"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ---- HÀM XÓA DỮ LIỆU ----
// Dùng chung cho nhiều loại: products, categories, reviews, shipping, payment
function deleteItem(endpoint, id) {
    if (confirm("Chắc chắn xóa?")) {
        // DELETE /api/{endpoint}/{id}
        fetch(`${apiUrl}/${endpoint}/${id}`, {
            method: "DELETE"
        }).then(() => {
            alert("Đã xóa!");
            
            // ---- RELOAD DATA TÙY THEO TAB HIỆN TẠI ----
            // Lấy tên tab đang active từ thuộc tính onclick của menu
            const activeTab = document.querySelector(".menu-item.active")
                              .getAttribute("onclick").match(/'(.*?)'/)[1];
            
            // Gọi hàm load tương ứng
            if (activeTab === "products") loadProducts();
            else if (activeTab === "categories") loadCategories();
            else if (activeTab === "reviews") loadReviews();
            else if (activeTab === "shipping") loadShipping();
            else if (activeTab === "payment") loadPayment();
        });
    }
}

// =========================================================
// PHẦN 8: XEM CHI TIẾT (PRODUCTS & ORDERS)
// =========================================================

// ---- HÀM XEM CHI TIẾT (CHUNG) ----
// Params:
//   - type: 'product' hoặc 'order'
//   - id: ID của item
function viewDetail(type, id) {
    const modal = document.getElementById("modal-detail");
    const content = document.getElementById("detail-content");
    const title = document.getElementById("detail-title");

    if (type === "product") {
        // ---- XEM CHI TIẾT SẢN PHẨM ----
        title.innerText = "Chi Tiết Sản Phẩm";
        
        fetch(`${apiUrl}/products/${id}`).then(r => r.json()).then(p => {
            content.innerHTML = `
                <img src="${p.thumbnail}" style="width:120px;border:1px solid #ddd">
                <br>
                <h3>${p.name}</h3>
                <p>Giá: ${formatMoney(p.price)}</p>
                <p>Kho: ${p.stock}</p>
                <p>${p.description}</p>
            `;
            modal.style.display = "flex";
        });
    } else if (type === "order") {
        // ---- XEM CHI TIẾT ĐƠN HÀNG ----
        // Dùng modal hóa đơn riêng (đẹp hơn)
        viewOrderInvoice(id);
    }
}

// ---- HÀM XEM HÓA ĐƠN ĐƠN HÀNG (MODAL INVOICE) ----
// Hiển thị chi tiết đơn hàng dạng hóa đơn chuyên nghiệp
async function viewOrderInvoice(orderId) {
    try {
        // ---- FETCH THÔNG TIN ĐƠN HÀNG ----
        const orderRes = await fetch(`${apiUrl}/admin/orders/${orderId}`);
        const order = await orderRes.json();
        
        // ---- FETCH CHI TIẾT SẢN PHẨM TRONG ĐƠN ----
        const detailsRes = await fetch(`${apiUrl}/orders/${orderId}/details`);
        const items = await detailsRes.json();
        
        // ---- ĐIỀN THÔNG TIN VÀO MODAL ----
        // Header
        document.getElementById("invoice-number").innerText = `Số: #${orderId}`;
        
        // Thông tin khách hàng
        document.getElementById("inv-customer-name").innerText = order.recipient_name || "---";
        document.getElementById("inv-customer-phone").innerText = order.recipient_phone || "---";
        document.getElementById("inv-customer-address").innerText = order.recipient_address || "---";
        
        // Thông tin đơn hàng
        document.getElementById("inv-order-date").innerText = new Date(order.order_date).toLocaleString("vi-VN");
        document.getElementById("inv-order-status").innerHTML = `<span class="badge bg-${order.status}">${getStatusText(order.status)}</span>`;
        document.getElementById("inv-payment-method").innerText = order.payment_method || "COD";
        
        // ---- RENDER BẢNG SẢN PHẨM ----
        let subtotal = 0;
        const itemsHtml = items.map((item, index) => {
            const itemTotal = item.price_at_time * item.quantity;
            subtotal += itemTotal;
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="product-info">
                            <img src="${item.thumbnail || '/assets/img/products/sp1.jpg'}" class="product-thumb" />
                            <span class="product-name">${item.name}</span>
                        </div>
                    </td>
                    <td>${item.color || 'Mặc định'}${item.size ? ', ' + item.size : ''}</td>
                    <td>${item.quantity}</td>
                    <td>${formatMoney(item.price_at_time)}</td>
                    <td>${formatMoney(itemTotal)}</td>
                </tr>
            `;
        }).join("");
        
        document.getElementById("inv-items-body").innerHTML = itemsHtml;
        
        // ---- TỔNG KẾT TIỀN ----
        const shippingFee = 30000; // Phí ship mặc định 30k
        document.getElementById("inv-subtotal").innerText = formatMoney(subtotal);
        document.getElementById("inv-shipping").innerText = formatMoney(shippingFee);
        document.getElementById("inv-discount").innerText = "-0₫";
        document.getElementById("inv-total").innerText = formatMoney(order.total_money);
        
        // Ghi chú
        document.getElementById("inv-note").innerText = order.note || "Không có ghi chú";
        
        // ---- LÝ DO HỦY (NẾU CÓ) ----
        const cancelReasonWrap = document.getElementById("inv-cancel-reason-wrap");
        if (order.status === "cancelled" && order.cancel_reason) {
            cancelReasonWrap.style.display = "block";
            document.getElementById("inv-cancel-reason").innerText = order.cancel_reason;
        } else {
            cancelReasonWrap.style.display = "none";
        }
        
        // Hiển thị modal
        document.getElementById("modal-order-invoice").style.display = "flex";
        
    } catch (error) {
        console.error("Lỗi khi tải chi tiết đơn hàng:", error);
        alert("Không thể tải chi tiết đơn hàng!");
    }
}

// ---- HÀM CHUYỂN STATUS CODE THÀNH TEXT ----
function getStatusText(status) {
    const statusMap = {
        "pending": "Chờ xác nhận",
        "shipping": "Đang vận chuyển",
        "completed": "Hoàn thành",
        "cancelled": "Đã hủy"
    };
    return statusMap[status] || status;
}

// ---- HÀM IN HÓA ĐƠN ----
// Sử dụng window.print() để in modal invoice
function printInvoice() {
    window.print();
}

// =========================================================
// PHẦN 9: KHỞI CHẠY (DOMCONTENTLOADED)
// =========================================================
// Chạy khi DOM đã load xong

document.addEventListener("DOMContentLoaded", () => {
    // ---- KHÔI PHỤC TAB ĐÃ LƯU ----
    // Lấy tab từ localStorage (hoặc mặc định là dashboard)
    const savedTab = localStorage.getItem("currentAdminTab") || "dashboard";
    
    // Chuyển đến tab đó
    switchTab(savedTab);
});