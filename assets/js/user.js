// =========================================================
// FILE: assets/js/user.js
// Mô tả: Quản lý Profile (Upload ảnh, Modal) và Đơn hàng (SPA)
// =========================================================

const userLog = JSON.parse(localStorage.getItem("user_login"));

if (!userLog) {
  alert("Bạn chưa đăng nhập!");
  window.location.href = "index.html";
}

// Biến toàn cục
let currentUserData = {};
let allOrders = [];
let selectedAvatarFile = null; // Lưu file ảnh khi chọn từ máy

// =========================================================
// 1. KHỞI TẠO & CHUYỂN TAB
// =========================================================
function initUserPage() {
    loadUserProfile();
    fetchOrders();
    
    // Kiểm tra URL xem cần mở tab nào (VD: user.html?tab=orders)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if(tab === 'orders') switchTab('orders');
    
    // Khởi tạo Dropdown ngày sinh
    initBirthdaySelects();

    // [QUAN TRỌNG] Lắng nghe sự kiện chọn file ảnh
    const fileInput = document.getElementById("input-avatar-file");
    if (fileInput) {
        fileInput.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedAvatarFile = file;
                // Xem trước ảnh ngay lập tức (Blob URL)
                document.getElementById("preview-avatar").src = URL.createObjectURL(file);
            }
        };
    }
}

function switchTab(tabName) {
    // Ẩn tất cả tab
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    // Reset style menu sidebar
    document.getElementById('menu-profile').querySelector('span').style.color = '#333';
    document.getElementById('menu-orders').querySelector('span').style.color = '#333';
    document.getElementById('submenu-profile').style.display = 'none';
    
    // Bật tab tương ứng
    if (tabName === 'profile') {
        document.getElementById('view-profile').classList.add('active');
        document.getElementById('menu-profile').querySelector('span').style.color = '#ee4d2d'; // Active màu cam
        document.getElementById('submenu-profile').style.display = 'block';
    } else if (tabName === 'orders') {
        document.getElementById('view-orders').classList.add('active');
        document.getElementById('menu-orders').querySelector('span').style.color = '#ee4d2d'; // Active màu cam
        backToOrderList(); // Đảm bảo luôn hiện danh sách trước
    }
}

// =========================================================
// 2. LOGIC PROFILE (LOAD & UPDATE)
// =========================================================
function loadUserProfile() {
  fetch(`${apiUrl}/users/${userLog.id}`)
    .then((res) => res.json())
    .then((user) => {
      currentUserData = user; // Lưu lại để dùng cho modal

      // A. Sidebar Info
      const sidebarName = document.getElementById("sidebar-name");
      const sidebarAvatar = document.getElementById("sidebar-avatar");
      if (sidebarName) sidebarName.innerText = user.full_name;
      
      // Xử lý link ảnh (Nếu là đường dẫn tương đối từ server thì thêm localhost)
      let avatarUrl = user.avatar;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
          avatarUrl = `http://localhost:3000${avatarUrl}`; // Link ảnh server
      }
      // Nếu không có ảnh thì dùng ảnh mặc định
      if (!avatarUrl) avatarUrl = `https://ui-avatars.com/api/?name=${user.full_name}&background=random`;

      if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
      
      // B. Form Chính
      document.getElementById("display-username").innerText = user.email ? user.email.split("@")[0] : user.full_name;
      document.getElementById("input-fullname").value = user.full_name;
      document.getElementById("preview-avatar").src = avatarUrl;

      // C. Hiển thị Text (Masking ***)
      const emailEl = document.getElementById("display-email");
      emailEl.innerText = user.email ? hideString(user.email, 'email') : "Chưa có";

      const phoneEl = document.getElementById("display-phone");
      phoneEl.innerText = user.phone ? hideString(user.phone, 'phone') : "Chưa có";

      const dobEl = document.getElementById("display-birthday");
      if (user.birthday) {
          const date = new Date(user.birthday);
          const year = date.getFullYear();
          dobEl.innerText = `**/**/${year}`;
      } else {
          dobEl.innerText = "Chưa có";
      }

      // D. Giới tính
      const genderValue = user.gender !== null ? user.gender : 1;
      document.getElementsByName("gender").forEach(r => {
          if (parseInt(r.value) === genderValue) r.checked = true;
      });
    })
    .catch((err) => console.error(err));
}

// --- LƯU FORM CHÍNH (Tên, Giới tính, Ảnh) ---
function saveMainProfile() {
    const fullName = document.getElementById("input-fullname").value.trim();
    let gender = 1;
    document.getElementsByName("gender").forEach((r) => { if (r.checked) gender = parseInt(r.value); });

    // Dùng FormData để gửi file ảnh
    const formData = new FormData();
    formData.append("full_name", fullName);
    formData.append("gender", gender);
    
    if (selectedAvatarFile) {
        formData.append("avatar", selectedAvatarFile);
    }

    fetch(`${apiUrl}/users/${userLog.id}`, {
        method: "PUT",
        body: formData // Không cần set Content-Type
    })
    .then((res) => res.json())
    .then((data) => {
        alert("Cập nhật thành công!");
        
        // [CẬP NHẬT MỚI] Lấy đường dẫn ảnh mới từ server trả về (nếu có)
        // Nếu không có ảnh mới (data.avatarPath null) thì dùng lại ảnh cũ
        const newAvatar = data.avatarPath || userLog.avatar;

        const newUser = { 
            ...userLog, 
            full_name: fullName,
            avatar: newAvatar
        };
        localStorage.setItem("user_login", JSON.stringify(newUser));
        
        location.reload();
    })
    .catch(() => alert("Lỗi cập nhật! Kiểm tra lại Server."));
}

// --- API UPDATE JSON (Cho Modal Email/Phone/Birthday) ---
function callUpdateAPI_JSON(dataObject) {
    fetch(`${apiUrl}/users/${userLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataObject),
    })
    .then((res) => res.json())
    .then(() => {
        alert("Cập nhật thành công!");
        location.reload();
    })
    .catch(() => alert("Lỗi cập nhật!"));
}

// --- MODAL LOGIC ---
function openProfileModal(type) {
    document.getElementById(`modal-change-${type}`).style.display = "flex";
    
    // Nếu là ngày sinh, điền giá trị cũ
    if (type === 'birthday' && currentUserData.birthday) {
        const d = new Date(currentUserData.birthday);
        document.getElementById('select-day').value = d.getDate();
        document.getElementById('select-month').value = d.getMonth() + 1;
        document.getElementById('select-year').value = d.getFullYear();
    }
}

function closeProfileModal(type) {
    document.getElementById(`modal-change-${type}`).style.display = "none";
}

function confirmChange(type) {
    if (type === 'email') {
        const val = document.getElementById('input-new-email').value.trim();
        if(!val) return alert("Vui lòng nhập Email!");
        callUpdateAPI_JSON({ email: val });
    } else if (type === 'phone') {
        const val = document.getElementById('input-new-phone').value.trim();
        if(!val) return alert("Vui lòng nhập SĐT!");
        callUpdateAPI_JSON({ phone: val });
    } else if (type === 'birthday') {
        const d = document.getElementById('select-day').value;
        const m = document.getElementById('select-month').value;
        const y = document.getElementById('select-year').value;
        if(d == 0 || m == 0 || y == 0) return alert("Vui lòng chọn ngày tháng năm!");
        
        const dateStr = `${y}-${m}-${d}`;
        callUpdateAPI_JSON({ birthday: dateStr });
    }
}

// --- UTILS ---
function initBirthdaySelects() {
    const daySel = document.getElementById('select-day');
    const monSel = document.getElementById('select-month');
    const yearSel = document.getElementById('select-year');

    // Reset trước khi thêm để tránh trùng lặp nếu gọi nhiều lần
    if (daySel.options.length > 1) return;

    for(let i=1; i<=31; i++) daySel.innerHTML += `<option value="${i}">${i}</option>`;
    for(let i=1; i<=12; i++) monSel.innerHTML += `<option value="${i}">${i}</option>`;
    const currentYear = new Date().getFullYear();
    for(let i=currentYear; i>=1950; i--) yearSel.innerHTML += `<option value="${i}">${i}</option>`;
}

function hideString(str, type) {
  if (!str) return "";
  if (type === 'email' && str.includes("@")) {
    const [name, domain] = str.split("@");
    return name.substring(0, 2) + "****" + name.substring(name.length - 1) + "@" + domain;
  }
  if (type === 'phone') {
      return str.substring(0, 3) + "****" + str.substring(str.length - 2);
  }
  return str;
}

// =========================================================
// 3. LOGIC MY ORDERS (LIST & DETAIL)
// =========================================================
function fetchOrders() {
    fetch(`${apiUrl}/my-orders/${userLog.id}`)
      .then((res) => res.json())
      .then((orders) => {
        allOrders = orders;
        renderOrderList(allOrders);
      })
      .catch((err) => console.error(err));
}

function filterOrder(status, tabElement) {
    document.querySelectorAll('.order-tab-item').forEach(el => el.classList.remove('active'));
    tabElement.classList.add('active');
    
    if (status === 'all') renderOrderList(allOrders);
    else renderOrderList(allOrders.filter(o => o.status === status));
}

function renderOrderList(orders) {
  const container = document.getElementById("my-order-list");
  
  if (!orders || orders.length === 0) {
    container.innerHTML = `
            <div style="background:white; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius:2px; box-shadow: 0 1px 1px 0 rgba(0,0,0,0.05);">
                <img src="./assets/img/no_order.png" style="width: 100px; height: 100px; object-fit: contain; opacity: 0.8;"> 
                <p style="font-size: 1.6rem; color: #333; margin-top: 20px; font-weight: 500;">Chưa có đơn hàng</p>
            </div>`;
    return;
  }

  let html = "";
  orders.forEach((order) => {
    let statusText = getStatusText(order.status);
    let buttonsHtml = getButtonsHtml(order.status, order.id);
    const itemsList = order.items || [];
    let productsHtml = "";

    if (itemsList.length > 0) {
        productsHtml = itemsList.map(item => `
            <div class="product-row">
                 <img src="${item.thumbnail || 'https://via.placeholder.com/80'}" class="product-img">
                 <div class="product-info">
                    <div class="product-name">${item.name}</div>
                    <div class="product-variant">Phân loại: ${item.color || 'Tiêu chuẩn'} ${item.size ? ', ' + item.size : ''}</div>
                    <div class="product-qty">x${item.quantity}</div>
                 </div>
                 <div class="product-price">
                    <span class="old-price">${formatMoney(item.price_at_time * 1.2)}</span>
                    <span style="color: #ee4d2d; font-weight: 500;">${formatMoney(item.price_at_time)}</span>
                 </div>
            </div>`).join("");
    } else {
        productsHtml = `<div style="padding: 20px; text-align: center; color: #777;">Đang cập nhật...</div>`;
    }

    html += `
        <div class="order-card">
            <div class="card-header">
                <div class="shop-info">
                    <span class="tag-mall">Yêu thích</span>
                    <span style="font-weight: bold; margin-left: 5px;">Twin Shop</span>
                    <button class="btn-chat"><i class="fa-regular fa-comment-dots"></i> Chat</button>
                    <button class="btn-view-shop"><i class="fa-solid fa-store"></i> Xem Shop</button>
                </div>
                <div class="order-status">${statusText}</div>
            </div>
            <div class="card-body" onclick="viewOrderDetail(${order.id})">
                ${productsHtml}
            </div>
            <div class="card-footer">
                <div class="total-section">
                    <span class="total-label">Thành tiền:</span>
                    <span class="total-price">${formatMoney(order.total_money)}</span>
                </div>
                <div class="action-section">
                    <span class="shipping-expected">Ngày đặt: ${new Date(order.order_date).toLocaleDateString("vi-VN")}</span>
                    <div style="display:flex; gap:10px;">${buttonsHtml}</div>
                </div>
            </div>
        </div>`;
  });
  container.innerHTML = html;
}

function viewOrderDetail(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if(!order) return;

  fetch(`${apiUrl}/orders/${orderId}/details`)
    .then((res) => res.json())
    .then((items) => {
        document.getElementById("order-list-view").style.display = "none";
        document.getElementById("order-detail-view").style.display = "block";
        window.scrollTo(0, 0);

        document.getElementById("detail-order-id").innerText = `MÃ ĐƠN HÀNG: ${order.id}`;
        document.getElementById("detail-order-status").innerText = ` | ${getStatusText(order.status)}`;
        document.getElementById("detail-name").innerText = order.recipient_name;
        document.getElementById("detail-phone").innerText = order.recipient_phone;
        document.getElementById("detail-address").innerText = order.recipient_address;

        updateStepper(order.status, order.order_date);

        const listDiv = document.getElementById("detail-product-list");
        listDiv.innerHTML = items.map(item => `
            <div class="product-row" style="padding: 15px 30px; border-bottom: 1px solid #f1f1f1;">
                <img src="${item.thumbnail}" class="product-img">
                <div class="product-info">
                    <div class="product-name">${item.name}</div>
                    <div class="product-variant">Phân loại: ${item.color || '-'}, ${item.size || '-'}</div>
                    <div class="product-qty">x${item.quantity}</div>
                </div>
                <div class="product-price" style="text-align: right; color: #ee4d2d;">${formatMoney(item.price_at_time)}</div>
            </div>`).join("");

        const shippingFee = 30000;
        const subTotal = order.total_money - shippingFee; 
        
        document.getElementById("detail-subtotal").innerText = formatMoney(subTotal > 0 ? subTotal : order.total_money);
        document.getElementById("detail-shipping").innerText = formatMoney(shippingFee);
        document.getElementById("detail-total").innerText = formatMoney(order.total_money);
        document.getElementById("detail-payment-method").innerText = order.payment_method === 'TWINPAY' ? 'Ví T-WinPay' : 'Thanh toán khi nhận hàng';
        
        document.getElementById("detail-actions-buttons").innerHTML = getButtonsHtml(order.status, order.id);
    });
}

function backToOrderList() {
    document.getElementById("order-detail-view").style.display = "none";
    document.getElementById("order-list-view").style.display = "block";
}

function updateStepper(status, dateStr) {
    const steps = [
        document.getElementById("step-1"),
        document.getElementById("step-2"),
        document.getElementById("step-3"),
        document.getElementById("step-4")
    ];
    const line = document.getElementById("stepper-line");
    
    steps.forEach(s => s.classList.remove("active"));
    const dateDisplay = new Date(dateStr).toLocaleString("vi-VN");

    steps[0].classList.add("active"); 
    document.getElementById("date-step-1").innerText = dateDisplay;

    let progress = 0;
    if (status === 'pending') progress = 0;
    else if (status === 'shipping') {
        steps[1].classList.add("active");
        steps[2].classList.add("active");
        progress = 66; 
        document.getElementById("date-step-2").innerText = dateDisplay;
        document.getElementById("date-step-3").innerText = "Đang giao"; 
    } 
    else if (status === 'completed') {
        steps.forEach(s => s.classList.add("active"));
        progress = 100;
        document.getElementById("date-step-4").innerText = "Hoàn thành";
    }
    
    line.style.width = progress + "%";
}

function getStatusText(status) {
    switch (status) {
      case "pending": return "CHỜ XÁC NHẬN";
      case "shipping": return "VẬN CHUYỂN";
      case "completed": return "HOÀN THÀNH";
      case "cancelled": return "ĐÃ HỦY";
      default: return status;
    }
}

function getButtonsHtml(status, orderId) {
    let html = `<button class="btn-action btn-primary" style="background:#ee4d2d; border:none; color:white;">Liên Hệ Người Bán</button>`;
    if (status === "pending") {
        html += `<button class="btn-action btn-outlined" onclick="cancelOrder(${orderId})">Hủy Đơn Hàng</button>`;
    } else if (status === "completed" || status === "cancelled") {
        html += `<button class="btn-action btn-outlined">Mua Lại</button>`;
    }
    return html;
}

function cancelOrder(orderId) {
  if (confirm("Xác nhận hủy đơn hàng này?")) {
    fetch(`${apiUrl}/orders/${orderId}/cancel`, { method: "PATCH" })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message);
        fetchOrders();
        backToOrderList();
      })
      .catch((err) => alert("Lỗi khi hủy đơn!"));
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

// CHẠY INIT
initUserPage();