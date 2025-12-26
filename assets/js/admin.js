const apiUrl = "/api";
let revenueChartInstance = null;
let pieChartInstance = null;

// Định dạng tiền VNĐ
function formatMoney(n) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(n || 0);
}
// Đóng modal
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

// Chuyển tab
function switchTab(tab, el) {
    localStorage.setItem("currentAdminTab", tab);
    if (!el) {
        el = document.querySelector(`.menu-item[onclick*="'${tab}'"]`);
    }

    // 1. Active menu
    if (el) {
        document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));
        el.classList.add("active");
        document.getElementById("page-title").innerText = el.innerText;
    }

    // 2. Active nội dung
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const target = document.getElementById("tab-" + tab);
    if (target) target.classList.add("active");

    // 3. Load Data 
    switch (tab) {
        case "dashboard": loadDashboard(); break;
        case "products": loadProducts(1); break;
        case "orders": loadOrders(); break;
        case "users": loadUsers(); break;
        case "reviews": loadReviews(); break;
        case "categories": loadCategories(); break;
        case "shipping": loadShipping(); break;
        case "payment": loadPayment(); break;
    }
}
// =========================================================
// 1. PRODUCTS (SEARCH, SORT, PAGINATION)
// =========================================================

function loadProducts(page = 1) {
    const search = document.getElementById("prod-search").value;
    const sort = document.getElementById("prod-sort").value;

    fetch(`${apiUrl}/products?page=${page}&limit=10&search=${search}&sort=${sort}`)
        .then(r => r.json())
        .then(d => {
            // Render Table
            document.getElementById("product-list").innerHTML = d.data.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><img src="${p.thumbnail}" style="width:40px;height:40px;object-fit:cover"></td>
                    <td>${p.name}</td>
                    <td style="color:#ee4d2d;font-weight:bold">${formatMoney(p.price)}</td>
                    <td>${p.stock}</td>
                    <td>
                        <button class="btn btn-view" onclick="viewDetail('product', ${p.id})">Xem</button>
                        <button class="btn btn-edit" onclick="openProductModal('edit', ${p.id})">Sửa</button>
                        <button class="btn btn-delete" onclick="deleteItem('products', ${p.id})">Xóa</button>
                    </td>
                </tr>
            `).join("");

            // Render Pagination
            const totalPages = d.pagination.totalPages;
            let paginationHtml = '';

            if (totalPages > 1) {
                const range = [];
                const delta = 2;

                for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
                        range.push(i);
                    }
                }

                let l;
                for (let i of range) {
                    if (l) {
                        if (i - l === 2) {
                            paginationHtml += `<button onclick="loadProducts(${l + 1})">${l + 1}</button>`;
                        } else if (i - l !== 1) {
                            paginationHtml += `<span class="dots">...</span>`;
                        }
                    }
                    paginationHtml += `<button class="${i === page ? 'active' : ''}" onclick="loadProducts(${i})">${i}</button>`;
                    l = i;
                }

                if (page < totalPages) {
                    paginationHtml += `<button onclick="loadProducts(${page + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
                }
            }

            document.getElementById("product-pagination").innerHTML = paginationHtml;
        });

    // Load danh mục cho select box
    fetch(`${apiUrl}/categories`).then(r => r.json()).then(cats => {
        const select = document.getElementById("p-category");
        if (select.options.length === 0) {
            select.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
        }
    });
}

function openProductModal(mode, id) {
    const form = document.getElementById("form-product");
    if (mode === "add") {
        form.reset();
        document.getElementById("p-id").value = "";
        document.getElementById("modal-product-title").innerText = "Thêm Sản Phẩm";
    } else {
        document.getElementById("modal-product-title").innerText = "Sửa Sản Phẩm #" + id;
        fetch(`${apiUrl}/products/${id}`).then(r => r.json()).then(p => {
            document.getElementById("p-id").value = p.id;
            document.getElementById("p-name").value = p.name;
            document.getElementById("p-price").value = p.price;
            document.getElementById("p-stock").value = p.stock;
            document.getElementById("p-category").value = p.category_id;
            document.getElementById("p-desc").value = p.description;
        });
    }
    document.getElementById("modal-product").style.display = "flex";
}

document.getElementById("form-product").addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("p-id").value;
    const formData = new FormData();
    formData.append("name", document.getElementById("p-name").value);
    formData.append("price", document.getElementById("p-price").value);
    formData.append("stock", document.getElementById("p-stock").value);
    formData.append("category_id", document.getElementById("p-category").value);
    formData.append("description", document.getElementById("p-desc").value);

    const thumb = document.getElementById("p-thumbnail").files[0];
    if (thumb) formData.append("thumbnail", thumb);
    const imgs = document.getElementById("p-images").files;
    for (let i = 0; i < imgs.length; i++) formData.append("images", imgs[i]);

    const method = id ? "PUT" : "POST";
    const url = id ? `${apiUrl}/products/${id}` : `${apiUrl}/products`;

    fetch(url, {
        method: method,
        body: formData
    }).then(() => {
        alert("Thành công!");
        closeModal("modal-product");
        loadProducts();
    });
});

// =========================================================
// 2. ORDERS
// =========================================================

function loadOrders() {
    const search = document.getElementById("order-search").value;
    const status = document.getElementById("order-status").value;

    fetch(`${apiUrl}/admin/orders?search=${search}&status=${status}`)
        .then(r => r.json())
        .then(orders => {
            document.getElementById("order-list").innerHTML = orders.map(o => `
                <tr>
                    <td>#${o.id}</td>
                    <td>${o.recipient_name}</td>
                    <td>${new Date(o.order_date).toLocaleDateString("vi-VN")}</td>
                    <td style="color:#ee4d2d;font-weight:bold">${formatMoney(o.total_money)}</td>
                    <td><span class="badge bg-${o.status}">${o.status}</span></td>
                    <td>
                        <button class="btn btn-view" onclick="viewDetail('order', ${o.id})">Xem</button>
                        ${o.status === "pending" ? `<button class="btn btn-add" onclick="updateOrderStatus(${o.id}, 'shipping')">Duyệt</button>` : ""}
                        ${o.status === "shipping" ? `<button class="btn btn-add" style="background:#28a745" onclick="updateOrderStatus(${o.id}, 'completed')">Xong</button>` : ""}
                    </td>
                </tr>
            `).join("");
        });
}

function updateOrderStatus(id, status) {
    if (confirm("Cập nhật trạng thái đơn hàng này?")) {
        fetch(`${apiUrl}/admin/orders/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status
            })
        }).then(() => {
            loadOrders();
        });
    }
}

// =========================================================
// 3. USERS
// =========================================================

function loadUsers() {
    const search = document.getElementById("user-search").value;
    fetch(`${apiUrl}/users?search=${search}`).then(r => r.json()).then(users => {
        document.getElementById("user-list").innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.full_name}</td>
                <td>${u.email}</td>
                <td>${u.phone || "Chưa có"}</td>
                <td>${u.role === 1 ? "Admin" : "Khách"}</td>
            </tr>
        `).join("");
    });
}

// =========================================================
// 4. REVIEWS
// =========================================================

function loadReviews() {
    fetch(`${apiUrl}/admin/reviews`).then(r => r.json()).then(reviews => {
        document.getElementById("review-list").innerHTML = reviews.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>${r.full_name}</td>
                <td>${r.product_name}</td>
                <td style="color:#fadb14">${"★".repeat(r.rating)}</td>
                <td>${r.comment}</td>
                <td><button class="btn btn-delete" onclick="deleteItem('admin/reviews', ${r.id})">Xóa</button></td>
            </tr>
        `).join("");
    });
}

// =========================================================
// 5. CATEGORIES, SHIPPING, PAYMENT
// =========================================================

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

function openSimpleModal(type, mode, id = null) {
    document.getElementById("form-simple").reset();
    document.getElementById("simple-type").value = type;
    document.getElementById("simple-id").value = id || "";

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

    if (mode === "edit") {
        document.getElementById("simple-title").innerText = "Sửa Thông Tin";
        let url = type === "category" ? `${apiUrl}/categories/${id}` : type === "shipping" ? `${apiUrl}/shipping/${id}` : `${apiUrl}/payment/${id}`;
        fetch(url).then(r => r.json()).then(d => {
            document.getElementById("inp-1").value = d.name;
            document.getElementById("inp-2").value = (type === "category") ? d.description : (type === "shipping") ? d.price : d.code;
        });
    } else {
        document.getElementById("simple-title").innerText = "Thêm Mới";
    }
    document.getElementById("modal-simple").style.display = "flex";
}

document.getElementById("form-simple").addEventListener("submit", function(e) {
    e.preventDefault();
    const type = document.getElementById("simple-type").value;
    const id = document.getElementById("simple-id").value;
    const val1 = document.getElementById("inp-1").value;
    const val2 = document.getElementById("inp-2").value;

    let body = {};
    if (type === "category") body = {
        name: val1,
        description: val2
    };
    else if (type === "shipping") body = {
        name: val1,
        price: val2
    };
    else body = {
        name: val1,
        code: val2
    };

    let url = type === "category" ? `${apiUrl}/categories` : type === "shipping" ? `${apiUrl}/shipping` : `${apiUrl}/payment`;
    let method = id ? "PUT" : "POST";
    if (id) url += `/${id}`;

    fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        .then(() => {
            closeModal("modal-simple");
            if (type === "category") loadCategories();
            if (type === "shipping") loadShipping();
            if (type === "payment") loadPayment();
        });
});

// =========================================================
// 6. DASHBOARD & DELETE
// =========================================================

function loadDashboard() {
    fetch(`${apiUrl}/admin/stats`).then(r => r.json()).then(d => {
        document.getElementById("stat-products").innerText = d.products;
        document.getElementById("stat-orders").innerText = d.orders;
        document.getElementById("stat-users").innerText = d.users;
        document.getElementById("stat-revenue").innerText = formatMoney(d.revenue);
    });
    fetch(`${apiUrl}/admin/orders`).then(r => r.json()).then(orders => {
        if (Array.isArray(orders)) {
            document.getElementById("dash-orders").innerHTML = orders.slice(0, 5).map(o => `<tr><td>#${o.id}</td><td>${o.recipient_name}</td><td>${formatMoney(o.total_money)}</td><td><span class="badge bg-${o.status}">${o.status}</span></td></tr>`).join("");
            processCharts(orders);
        }
    });
    fetch(`${apiUrl}/products`).then(r => r.json()).then(d => {
        if (Array.isArray(d.data)) document.getElementById("dash-low-stock").innerHTML = d.data.filter(p => p.stock < 10).slice(0, 5).map(p => `<tr><td><img src="${p.thumbnail}"></td><td>${p.name}</td><td style="color:red">${p.stock}</td></tr>`).join("");
    });
}

function processCharts(orders) {
    const last7Days = [];
    const revenueData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        last7Days.push(`${d.getDate()}/${d.getMonth() + 1}`);
        const dateCheck = d.toDateString();
        const total = orders.reduce((sum, o) => {
            const oDate = new Date(o.order_date);
            return oDate.toDateString() === dateCheck && o.status !== "cancelled" ? sum + Number(o.total_money) : sum;
        }, 0);
        revenueData.push(total);
    }
    const statusCounts = {
        pending: 0,
        shipping: 0,
        completed: 0,
        cancelled: 0
    };
    orders.forEach((o) => {
        if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
    });

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(document.getElementById("revenueChart"), {
        type: "bar",
        data: {
            labels: last7Days,
            datasets: [{
                label: "Doanh thu",
                data: revenueData,
                backgroundColor: "#ee4d2d"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(document.getElementById("pieChart"), {
        type: "doughnut",
        data: {
            labels: ["Chờ", "Giao", "Xong", "Hủy"],
            datasets: [{
                data: [statusCounts.pending, statusCounts.shipping, statusCounts.completed, statusCounts.cancelled],
                backgroundColor: ["#fa8c16", "#1890ff", "#52c41a", "#f5222d"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function deleteItem(endpoint, id) {
    if (confirm("Chắc chắn xóa?")) {
        fetch(`${apiUrl}/${endpoint}/${id}`, {
            method: "DELETE"
        }).then(() => {
            alert("Đã xóa!");
            const activeTab = document.querySelector(".menu-item.active").getAttribute("onclick").match(/'(.*?)'/)[1];
            if (activeTab === "products") loadProducts();
            else if (activeTab === "categories") loadCategories();
            else if (activeTab === "reviews") loadReviews();
            else if (activeTab === "shipping") loadShipping();
            else if (activeTab === "payment") loadPayment();
        });
    }
}

function viewDetail(type, id) {
    const modal = document.getElementById("modal-detail");
    const content = document.getElementById("detail-content");
    const title = document.getElementById("detail-title");

    if (type === "product") {
        title.innerText = "Chi Tiết Sản Phẩm";
        fetch(`${apiUrl}/products/${id}`).then(r => r.json()).then(p => {
            content.innerHTML = `<img src="${p.thumbnail}" style="width:120px;border:1px solid #ddd"><br><h3>${p.name}</h3><p>Giá: ${formatMoney(p.price)}</p><p>Kho: ${p.stock}</p><p>${p.description}</p>`;
            modal.style.display = "flex";
        });
    } else if (type === "order") {
        title.innerText = "Chi Tiết Đơn Hàng #" + id;
        fetch(`${apiUrl}/orders/${id}/details`).then(r => r.json()).then(items => {
            content.innerHTML = `<table style="width:100%"><thead><tr><th>Món</th><th>SL</th><th>Giá</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td>x${i.quantity}</td><td>${formatMoney(i.price_at_time)}</td></tr>`).join("")}</tbody></table>`;
            modal.style.display = "flex";
        });
    }
}

// =========================================================
// KHỞI CHẠY (ĐÃ SỬA ĐỂ GIỮ TAB KHI F5)
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    const savedTab = localStorage.getItem("currentAdminTab") || "dashboard";
    switchTab(savedTab);
});