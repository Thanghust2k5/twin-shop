// =========================================================
// FILE: assets/js/user.js
// Mô tả: Quản lý Profile (Upload ảnh, Modal) và Đơn hàng (SPA)
// =========================================================
//
// MỤC ĐÍCH: Quản lý toàn bộ trang cá nhân của người dùng
// File này xử lý:
//   - Hiển thị & cập nhật thông tin cá nhân (tên, avatar, giới tính)
//   - Modal thay đổi email, số điện thoại, ngày sinh
//   - Danh sách đơn hàng của user (lọc theo trạng thái)
//   - Chi tiết đơn hàng (stepper tiến trình)
//   - Hủy đơn hàng với lý do
//
// CẤU TRÚC FILE:
//   1. Khởi tạo & chuyển tab (SPA - Single Page Application)
//   2. Logic Profile (load, update, upload ảnh)
//   3. Modal logic (email, phone, birthday)
//   4. Logic đơn hàng (list, detail, stepper)
//   5. Modal hủy đơn hàng
//   6. Các hàm tiện ích (format tiền, ẩn thông tin)
// =========================================================

// =========================================================
// PHẦN 1: KHỞI TẠO - KIỂM TRA ĐĂNG NHẬP
// =========================================================

// ---- LẤY THÔNG TIN USER TỪ LOCALSTORAGE ----
// safeJSONParse: Hàm parse an toàn từ validation.js
// Nếu localStorage không có "user_login" -> userLog = null
const userLog = safeJSONParse(localStorage.getItem("user_login"));

// ---- KIỂM TRA ĐĂNG NHẬP ----
// Trang user.html yêu cầu phải đăng nhập
// Nếu chưa -> báo lỗi và đẩy về trang chủ
if (!userLog) {
  alert("Bạn chưa đăng nhập!");
  window.location.href = "index.html";
}

// ---- BIẾN TOÀN CỤC ----
// currentUserData: Lưu data user từ API (để dùng trong modal)
let currentUserData = {};

// allOrders: Mảng tất cả đơn hàng của user
let allOrders = [];

// selectedAvatarFile: Lưu file ảnh khi user chọn từ máy tính
// Dùng cho việc upload avatar lên server
let selectedAvatarFile = null;

// =========================================================
// PHẦN 2: KHỞI CHẠY TRANG & CHUYỂN TAB (SPA)
// =========================================================
// SPA (Single Page Application):
//   - Không reload trang khi chuyển giữa Profile và Đơn hàng
//   - Chỉ ẩn/hiện các phần tử DOM tương ứng
//   - Cảm giác mượt mà hơn cho người dùng

// ---- HÀM KHỞI TẠO TRANG USER ----
// Gọi một lần khi trang load xong
function initUserPage() {
    // Load thông tin profile từ API
    loadUserProfile();
    
    // Load danh sách đơn hàng
    fetchOrders();
    
    // ---- KIỂM TRA URL PARAMETER ----
    // VD: user.html?tab=orders sẽ mở thẳng tab đơn hàng
    // Hữu ích khi link từ trang khác (VD: sau khi đặt hàng xong)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if(tab === 'orders') switchTab('orders');
    
    // Khởi tạo các dropdown chọn ngày/tháng/năm sinh
    initBirthdaySelects();

    // ---- LẮNG NGHE SỰ KIỆN CHỌN FILE ẢNH ----
    // Khi user chọn ảnh mới để upload avatar
    const fileInput = document.getElementById("input-avatar-file");
    if (fileInput) {
        fileInput.onchange = function(e) {
            // Lấy file đầu tiên từ danh sách file được chọn
            const file = e.target.files[0];
            if (file) {
                // Lưu file vào biến toàn cục để sau này gửi lên server
                selectedAvatarFile = file;
                
                // ---- XEM TRƯỚC ẢNH ----
                // URL.createObjectURL: Tạo URL tạm thời từ file
                // Cho phép hiển thị ảnh ngay mà chưa upload
                document.getElementById("preview-avatar").src = URL.createObjectURL(file);
            }
        };
    }
}

// ---- HÀM CHUYỂN TAB (PROFILE / ORDERS) ----
// SPA: Chỉ thay đổi DOM, không reload trang
// Params:
//   - tabName: 'profile' hoặc 'orders'
function switchTab(tabName) {
    // ---- ẨN TẤT CẢ TAB ----
    // Bỏ class 'active' khỏi tất cả tab-content
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    // ---- RESET STYLE MENU SIDEBAR ----
    // Đưa tất cả menu về màu mặc định (đen)
    document.getElementById('menu-profile').querySelector('span').style.color = '#333';
    document.getElementById('menu-orders').querySelector('span').style.color = '#333';
    
    // Ẩn submenu của profile
    document.getElementById('submenu-profile').style.display = 'none';
    
    // ---- BẬT TAB TƯƠNG ỨNG ----
    if (tabName === 'profile') {
        // Hiện view profile
        document.getElementById('view-profile').classList.add('active');
        
        // Active màu cam cho menu profile
        document.getElementById('menu-profile').querySelector('span').style.color = '#ee4d2d';
        
        // Hiện submenu profile (Email, Phone, Birthday)
        document.getElementById('submenu-profile').style.display = 'block';
    } else if (tabName === 'orders') {
        // Hiện view orders
        document.getElementById('view-orders').classList.add('active');
        
        // Active màu cam cho menu orders
        document.getElementById('menu-orders').querySelector('span').style.color = '#ee4d2d';
        
        // Đảm bảo luôn hiện danh sách trước (không phải chi tiết)
        backToOrderList();
    }
}

// =========================================================
// PHẦN 3: LOGIC PROFILE (LOAD & UPDATE)
// =========================================================
// Mục đích: Xử lý việc hiển thị và cập nhật thông tin cá nhân

// ---- HÀM TẢI THÔNG TIN PROFILE TỪ API ----
// Gọi API lấy data user và hiển thị lên form
function loadUserProfile() {
  // GET /api/users/{id}
  fetch(`${apiUrl}/users/${userLog.id}`)
    .then((res) => res.json())
    .then((user) => {
      // ---- LƯU DATA VÀO BIẾN TOÀN CỤC ----
      // Dùng cho các modal sau này (VD: điền sẵn ngày sinh)
      currentUserData = user;

      // ============ A. SIDEBAR INFO ============
      // Cập nhật tên và avatar ở thanh sidebar bên trái
      const sidebarName = document.getElementById("sidebar-name");
      const sidebarAvatar = document.getElementById("sidebar-avatar");
      if (sidebarName) sidebarName.innerText = user.full_name;
      
      // ---- XỬ LÝ ĐƯỜNG DẪN ẢNH ----
      let avatarUrl = user.avatar;
      // Nếu là đường dẫn tương đối (VD: /uploads/xxx.jpg)
      // Thì thêm domain server phía trước
      if (avatarUrl && !avatarUrl.startsWith('http')) {
          avatarUrl = `http://localhost:3000${avatarUrl}`;
      }
      // Nếu không có ảnh -> tạo avatar từ tên (dùng UI Avatars API)
      if (!avatarUrl) {
          avatarUrl = `https://ui-avatars.com/api/?name=${user.full_name}&background=random`;
      }

      if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
      
      // ============ B. FORM CHÍNH ============
      // Hiển thị username (lấy phần trước @ của email)
      document.getElementById("display-username").innerText = 
          user.email ? user.email.split("@")[0] : user.full_name;
      
      // Điền họ tên vào input
      document.getElementById("input-fullname").value = user.full_name;
      
      // Hiển thị ảnh preview
      document.getElementById("preview-avatar").src = avatarUrl;

      // ============ C. HIỂN THỊ TEXT (MASKED) ============
      // Ẩn một phần thông tin nhạy cảm để bảo mật
      // VD: "nguyenvana@gmail.com" -> "ng***a@gmail.com"
      const emailEl = document.getElementById("display-email");
      emailEl.innerText = user.email ? hideString(user.email, 'email') : "Chưa có";

      // VD: "0912345678" -> "091****78"
      const phoneEl = document.getElementById("display-phone");
      phoneEl.innerText = user.phone ? hideString(user.phone, 'phone') : "Chưa có";

      // Ngày sinh: Chỉ hiện năm
      const dobEl = document.getElementById("display-birthday");
      if (user.birthday) {
          const date = new Date(user.birthday);
          const year = date.getFullYear();
          dobEl.innerText = `**/**/${year}`; // Ẩn ngày/tháng
      } else {
          dobEl.innerText = "Chưa có";
      }

      // ============ D. GIỚI TÍNH ============
      // Tìm radio button tương ứng và check
      const genderValue = user.gender !== null ? user.gender : 1;
      document.getElementsByName("gender").forEach(r => {
          if (parseInt(r.value) === genderValue) r.checked = true;
      });
    })
    .catch((err) => console.error(err));
}

// ---- HÀM LƯU THÔNG TIN CHÍNH (TÊN, GIỚI TÍNH, ẢNH) ----
// Gọi khi user click nút "Lưu" trên form profile
function saveMainProfile() {
    // Lấy giá trị họ tên từ input
    const fullName = document.getElementById("input-fullname").value.trim();
    
    // Lấy giới tính từ radio button được chọn
    let gender = 1; // Mặc định Nam
    document.getElementsByName("gender").forEach((r) => { 
        if (r.checked) gender = parseInt(r.value); 
    });

    // ---- SỬ DỤNG FORMDATA ĐỂ GỬI FILE ----
    // FormData cho phép gửi cả text và file trong 1 request
    // Không thể dùng JSON.stringify khi có file
    const formData = new FormData();
    formData.append("full_name", fullName);
    formData.append("gender", gender);
    
    // Chỉ thêm avatar nếu user đã chọn file mới
    if (selectedAvatarFile) {
        formData.append("avatar", selectedAvatarFile);
    }

    // ---- GỬI REQUEST PUT ----
    // Không set Content-Type, browser sẽ tự set multipart/form-data
    fetch(`${apiUrl}/users/${userLog.id}`, {
        method: "PUT",
        body: formData
    })
    .then((res) => res.json())
    .then((data) => {
        alert("Cập nhật thành công!");
        
        // ---- CẬP NHẬT LOCALSTORAGE ----
        // Lấy đường dẫn ảnh mới từ server (nếu có)
        const newAvatar = data.avatarPath || userLog.avatar;

        // Tạo object user mới với data đã cập nhật
        const newUser = { 
            ...userLog,           // Spread: copy tất cả thuộc tính cũ
            full_name: fullName,  // Ghi đè tên mới
            avatar: newAvatar     // Ghi đè avatar mới
        };
        
        // Lưu lại vào localStorage
        localStorage.setItem("user_login", JSON.stringify(newUser));
        
        // Reload trang để cập nhật UI
        location.reload();
    })
    .catch(() => alert("Lỗi cập nhật! Kiểm tra lại Server."));
}

// =========================================================
// PHẦN 4: MODAL CẬP NHẬT (EMAIL, PHONE, BIRTHDAY)
// =========================================================
// Mục đích: Xử lý các modal popup để cập nhật thông tin nhạy cảm

// ---- HÀM GỌI API UPDATE VỚI JSON ----
// Dùng cho modal (Email, Phone, Birthday)
// Khác với saveMainProfile dùng FormData cho file
function callUpdateAPI_JSON(dataObject) {
    fetch(`${apiUrl}/users/${userLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataObject), // Gửi data dạng JSON
    })
    .then((res) => res.json())
    .then(() => {
        alert("Cập nhật thành công!");
        location.reload(); // Reload để hiển thị data mới
    })
    .catch(() => alert("Lỗi cập nhật!"));
}

// ---- HÀM MỞ MODAL ----
// Params:
//   - type: Loại modal ('email', 'phone', 'birthday')
function openProfileModal(type) {
    // Hiển thị modal tương ứng (flex để center)
    document.getElementById(`modal-change-${type}`).style.display = "flex";
    
    // ---- ĐIỀN SẴN GIÁ TRỊ CŨ CHO NGÀY SINH ----
    if (type === 'birthday' && currentUserData.birthday) {
        const d = new Date(currentUserData.birthday);
        document.getElementById('select-day').value = d.getDate();
        document.getElementById('select-month').value = d.getMonth() + 1; // getMonth() trả về 0-11
        document.getElementById('select-year').value = d.getFullYear();
    }
}

// ---- HÀM ĐÓNG MODAL ----
function closeProfileModal(type) {
    document.getElementById(`modal-change-${type}`).style.display = "none";
}

// ---- HÀM XÁC NHẬN THAY ĐỔI TỪ MODAL ----
// Validate input và gọi API update
function confirmChange(type) {
    if (type === 'email') {
        // ---- CẬP NHẬT EMAIL ----
        const inputEl = document.getElementById('input-new-email');
        const val = inputEl.value.trim();
        
        // Validate email bằng Validator từ validation.js
        const result = Validator.validateEmail(val);
        if (!result.isValid) {
            Validator.showError(inputEl, result.message);
            return; // Dừng nếu không hợp lệ
        }
        Validator.clearError(inputEl);
        
        // Gọi API update
        callUpdateAPI_JSON({ email: val });
        
    } else if (type === 'phone') {
        // ---- CẬP NHẬT SỐ ĐIỆN THOẠI ----
        const inputEl = document.getElementById('input-new-phone');
        const val = inputEl.value.trim();
        
        // Validate phone
        const result = Validator.validatePhone(val);
        if (!result.isValid) {
            Validator.showError(inputEl, result.message);
            return;
        }
        Validator.clearError(inputEl);
        callUpdateAPI_JSON({ phone: val });
        
    } else if (type === 'birthday') {
        // ---- CẬP NHẬT NGÀY SINH ----
        const d = document.getElementById('select-day').value;
        const m = document.getElementById('select-month').value;
        const y = document.getElementById('select-year').value;
        
        // Validate ngày sinh
        const result = Validator.validateBirthday(d, m, y);
        if (!result.isValid) {
            return alert(result.message);
        }
        
        // Format thành YYYY-MM-DD để lưu vào DB
        const dateStr = `${y}-${m}-${d}`;
        callUpdateAPI_JSON({ birthday: dateStr });
    }
}

// =========================================================
// PHẦN 5: CÁC HÀM TIỆN ÍCH CHO PROFILE
// =========================================================

// ---- HÀM KHỞI TẠO DROPDOWN NGÀY SINH ----
// Tạo các option cho select ngày, tháng, năm
function initBirthdaySelects() {
    const daySel = document.getElementById('select-day');
    const monSel = document.getElementById('select-month');
    const yearSel = document.getElementById('select-year');

    // Kiểm tra nếu đã có option -> không thêm nữa
    // Tránh trùng lặp nếu hàm được gọi nhiều lần
    if (daySel.options.length > 1) return;

    // Thêm ngày 1-31
    for(let i=1; i<=31; i++) {
        daySel.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // Thêm tháng 1-12
    for(let i=1; i<=12; i++) {
        monSel.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // Thêm năm từ hiện tại đến 1950 (giảm dần)
    const currentYear = new Date().getFullYear();
    for(let i=currentYear; i>=1950; i--) {
        yearSel.innerHTML += `<option value="${i}">${i}</option>`;
    }
}

// ---- HÀM ẨN CHUỖI (MASKING) ----
// Mục đích: Bảo mật thông tin nhạy cảm khi hiển thị
// VD: "nguyenvana@gmail.com" -> "ng***a@gmail.com"
function hideString(str, type) {
  if (!str) return "";
  
  if (type === 'email' && str.includes("@")) {
    // Tách email thành name và domain
    const [name, domain] = str.split("@");
    // Lấy 2 ký tự đầu + **** + ký tự cuối + @ + domain
    return name.substring(0, 2) + "****" + name.substring(name.length - 1) + "@" + domain;
  }
  
  if (type === 'phone') {
      // Lấy 3 số đầu + **** + 2 số cuối
      return str.substring(0, 3) + "****" + str.substring(str.length - 2);
  }
  
  return str;
}

// =========================================================
// PHẦN 6: QUẢN LÝ ĐƠN HÀNG (MY ORDERS)
// =========================================================
// Mục đích: Hiển thị, lọc và xem chi tiết đơn hàng của user

// ---- HÀM TẢI DANH SÁCH ĐƠN HÀNG ----
function fetchOrders() {
    // GET /api/my-orders/{userId}
    fetch(`${apiUrl}/my-orders/${userLog.id}`)
      .then((res) => res.json())
      .then((orders) => {
        // Lưu vào biến toàn cục để dùng cho filter và chi tiết
        allOrders = orders;
        
        // Render danh sách ra UI
        renderOrderList(allOrders);
      })
      .catch((err) => console.error(err));
}

// ---- HÀM LỌC ĐƠN HÀNG THEO TRẠNG THÁI ----
// Gọi khi user click các tab (Tất cả, Chờ xác nhận, Vận chuyển, ...)
// Params:
//   - status: Trạng thái cần lọc ('all', 'pending', 'shipping', 'completed', 'cancelled')
//   - tabElement: Element tab được click (để thêm class active)
function filterOrder(status, tabElement) {
    // Bỏ active khỏi tất cả tab
    document.querySelectorAll('.order-tab-item').forEach(el => el.classList.remove('active'));
    
    // Thêm active vào tab được click
    tabElement.classList.add('active');
    
    // Render danh sách theo filter
    if (status === 'all') {
        renderOrderList(allOrders); // Hiển thị tất cả
    } else {
        // Lọc chỉ lấy đơn hàng có status tương ứng
        renderOrderList(allOrders.filter(o => o.status === status));
    }
}

// ---- HÀM RENDER DANH SÁCH ĐƠN HÀNG ----
// Tạo HTML cho từng đơn hàng và hiển thị
function renderOrderList(orders) {
  const container = document.getElementById("my-order-list");
  
  // ---- TRƯỜNG HỢP KHÔNG CÓ ĐƠN HÀNG ----
  if (!orders || orders.length === 0) {
    container.innerHTML = `
            <div style="background:white; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius:2px; box-shadow: 0 1px 1px 0 rgba(0,0,0,0.05);">
                <img src="./assets/img/no_order.png" style="width: 100px; height: 100px; object-fit: contain; opacity: 0.8;"> 
                <p style="font-size: 1.6rem; color: #333; margin-top: 20px; font-weight: 500;">Chưa có đơn hàng</p>
            </div>`;
    return;
  }

  // ---- DUYỆT QUA TỪNG ĐƠN HÀNG VÀ TẠO HTML ----
  let html = "";
  orders.forEach((order) => {
    // Chuyển status code thành text hiển thị
    let statusText = getStatusText(order.status);
    
    // Tạo các nút action tùy theo trạng thái
    let buttonsHtml = getButtonsHtml(order.status, order.id);
    
    // Lấy danh sách sản phẩm trong đơn
    const itemsList = order.items || [];
    
    // ---- TẠO HTML CHO DANH SÁCH SẢN PHẨM ----
    let productsHtml = "";

    if (itemsList.length > 0) {
        // Duyệt qua từng sản phẩm và tạo HTML
        productsHtml = itemsList.map(item => `
            <div class="product-row">
                 <!-- Ảnh sản phẩm -->
                 <img src="${item.thumbnail || 'https://via.placeholder.com/80'}" class="product-img">
                 
                 <!-- Thông tin sản phẩm -->
                 <div class="product-info">
                    <div class="product-name">${item.name}</div>
                    <div class="product-variant">Phân loại: ${item.color || 'Tiêu chuẩn'} ${item.size ? ', ' + item.size : ''}</div>
                    <div class="product-qty">x${item.quantity}</div>
                 </div>
                 
                 <!-- Giá sản phẩm -->
                 <div class="product-price">
                    <span class="old-price">${formatMoney(item.price_at_time * 1.2)}</span>
                    <span style="color: #ee4d2d; font-weight: 500;">${formatMoney(item.price_at_time)}</span>
                 </div>
            </div>`).join("");
    } else {
        productsHtml = `<div style="padding: 20px; text-align: center; color: #777;">Đang cập nhật...</div>`;
    }

    // ---- TẠO HTML CHO 1 ĐƠN HÀNG (ORDER CARD) ----
    html += `
        <div class="order-card">
            <!-- Header: Shop info + Status -->
            <div class="card-header">
                <div class="shop-info">
                    <span style="font-weight: bold; margin-left: 5px;">Twin Shop</span>
                    <button class="btn-chat"><i class="fa-regular fa-comment-dots"></i> Chat</button>
                </div>
                <div class="order-status">${statusText}</div>
            </div>
            
            <!-- Body: Danh sách sản phẩm (click để xem chi tiết) -->
            <div class="card-body" onclick="viewOrderDetail(${order.id})">
                ${productsHtml}
            </div>
            
            <!-- Footer: Tổng tiền + Actions -->
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

// ---- HÀM XEM CHI TIẾT ĐƠN HÀNG ----
// Chuyển sang view chi tiết và hiển thị thông tin đầy đủ
function viewOrderDetail(orderId) {
  // Tìm đơn hàng trong mảng allOrders
  const order = allOrders.find(o => o.id === orderId);
  if(!order) return;

  // Gọi API lấy danh sách items chi tiết của đơn hàng
  fetch(`${apiUrl}/orders/${orderId}/details`)
    .then((res) => res.json())
    .then((items) => {
        // ---- CHUYỂN VIEW ----
        // Ẩn list view, hiện detail view (SPA)
        document.getElementById("order-list-view").style.display = "none";
        document.getElementById("order-detail-view").style.display = "block";
        window.scrollTo(0, 0); // Cuộn lên đầu trang

        // ---- HIỂN THỊ THÔNG TIN ĐƠN HÀNG ----
        document.getElementById("detail-order-id").innerText = `MÃ ĐƠN HÀNG: ${order.id}`;
        document.getElementById("detail-order-status").innerText = ` | ${getStatusText(order.status)}`;
        
        // Thông tin người nhận
        document.getElementById("detail-name").innerText = order.recipient_name;
        document.getElementById("detail-phone").innerText = order.recipient_phone;
        document.getElementById("detail-address").innerText = order.recipient_address;

        // Cập nhật stepper (thanh tiến trình đơn hàng)
        updateStepper(order.status, order.order_date);

        // ---- RENDER DANH SÁCH SẢN PHẨM ----
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

        // ---- TÍNH TOÁN VÀ HIỂN THỊ TỔNG TIỀN ----
        const shippingFee = 30000; // Phí ship cố định 30k
        const subTotal = order.total_money - shippingFee; 
        
        document.getElementById("detail-subtotal").innerText = formatMoney(subTotal > 0 ? subTotal : order.total_money);
        document.getElementById("detail-shipping").innerText = formatMoney(shippingFee);
        document.getElementById("detail-total").innerText = formatMoney(order.total_money);
        
        // Phương thức thanh toán
        document.getElementById("detail-payment-method").innerText = 
            order.payment_method === 'TWINPAY' ? 'Ví T-WinPay' : 'Thanh toán khi nhận hàng';
        
        // Các nút action
        document.getElementById("detail-actions-buttons").innerHTML = getButtonsHtml(order.status, order.id);
    });
}

// ---- HÀM QUAY LẠI DANH SÁCH ĐƠN HÀNG ----
function backToOrderList() {
    // Ẩn detail view, hiện list view
    document.getElementById("order-detail-view").style.display = "none";
    document.getElementById("order-list-view").style.display = "block";
}

// ---- HÀM CẬP NHẬT STEPPER (THANH TIẾN TRÌNH) ----
// Hiển thị tiến trình đơn hàng: Đặt hàng -> Xác nhận -> Vận chuyển -> Hoàn thành
function updateStepper(status, dateStr) {
    // Lấy tất cả các step
    const steps = [
        document.getElementById("step-1"), // Đặt hàng
        document.getElementById("step-2"), // Xác nhận
        document.getElementById("step-3"), // Vận chuyển
        document.getElementById("step-4")  // Hoàn thành
    ];
    
    // Thanh progress (đường kẻ xanh)
    const line = document.getElementById("stepper-line");
    
    // Reset tất cả step về trạng thái chưa active
    steps.forEach(s => s.classList.remove("active"));
    
    // Format ngày giờ
    const dateDisplay = new Date(dateStr).toLocaleString("vi-VN");

    // Step 1 luôn active (đã đặt hàng)
    steps[0].classList.add("active"); 
    document.getElementById("date-step-1").innerText = dateDisplay;

    // ---- XÁC ĐỊNH TIẾN TRÌNH DỰA TRÊN STATUS ----
    let progress = 0; // % của thanh progress
    
    if (status === 'pending') {
        progress = 0; // Mới đặt, chưa tiến triển
    }
    else if (status === 'shipping') {
        // Đang vận chuyển -> active step 2, 3
        steps[1].classList.add("active");
        steps[2].classList.add("active");
        progress = 66; // 2/3 thanh
        document.getElementById("date-step-2").innerText = dateDisplay;
        document.getElementById("date-step-3").innerText = "Đang giao"; 
    } 
    else if (status === 'completed') {
        // Hoàn thành -> active tất cả step
        steps.forEach(s => s.classList.add("active"));
        progress = 100; // Full thanh
        document.getElementById("date-step-4").innerText = "Hoàn thành";
    }
    
    // Cập nhật width của thanh progress
    line.style.width = progress + "%";
}

// ---- HÀM CHUYỂN STATUS CODE THÀNH TEXT ----
function getStatusText(status) {
    switch (status) {
      case "pending": return "CHỜ XÁC NHẬN";
      case "shipping": return "VẬN CHUYỂN";
      case "completed": return "HOÀN THÀNH";
      case "cancelled": return "ĐÃ HỦY";
      default: return status;
    }
}

// ---- HÀM TẠO CÁC NÚT ACTION TÙY THEO TRẠNG THÁI ----
function getButtonsHtml(status, orderId) {
    // Nút Liên hệ người bán (luôn có)
    let html = `<button class="btn-action btn-primary" style="background:#ee4d2d; border:none; color:white;">Liên Hệ Người Bán</button>`;
    
    if (status === "pending") {
        // Đơn hàng chờ xác nhận -> có thể hủy
        html += `<button class="btn-action btn-outlined" onclick="openCancelModal(${orderId})">Hủy Đơn Hàng</button>`;
    } else if (status === "completed" || status === "cancelled") {
        // Đơn hoàn thành hoặc đã hủy -> có thể mua lại
        html += `<button class="btn-action btn-outlined">Mua Lại</button>`;
    }
    return html;
}

// =========================================================
// PHẦN 7: MODAL HỦY ĐƠN HÀNG
// =========================================================
// Mục đích: Xử lý việc hủy đơn hàng với lý do

// ---- HÀM MỞ MODAL HỦY ĐƠN ----
function openCancelModal(orderId) {
    // Lưu orderId vào hidden input để dùng khi confirm
    document.getElementById('cancel-order-id').value = orderId;
    
    // Hiển thị modal
    document.getElementById('modal-cancel-order').style.display = 'flex';
    
    // ---- RESET FORM ----
    // Bỏ chọn tất cả radio button
    const radioButtons = document.querySelectorAll('input[name="cancel-reason"]');
    radioButtons.forEach(rb => rb.checked = false);
    
    // Ẩn textarea "Lý do khác"
    document.getElementById('cancel-reason-other').style.display = 'none';
    document.getElementById('cancel-reason-other').value = '';
}

// ---- HÀM ĐÓNG MODAL HỦY ĐƠN ----
function closeCancelModal() {
    document.getElementById('modal-cancel-order').style.display = 'none';
}

// ---- SỰ KIỆN: HIỂN THỊ TEXTAREA KHI CHỌN "KHÁC" ----
// Lắng nghe sự kiện change trên tất cả radio button
document.addEventListener('DOMContentLoaded', function() {
    const radioButtons = document.querySelectorAll('input[name="cancel-reason"]');
    const otherTextarea = document.getElementById('cancel-reason-other');
    
    if (radioButtons && otherTextarea) {
        radioButtons.forEach(rb => {
            rb.addEventListener('change', function() {
                if (this.value === 'other') {
                    // Nếu chọn "Khác" -> hiện textarea để nhập lý do
                    otherTextarea.style.display = 'block';
                    otherTextarea.focus();
                } else {
                    // Chọn lý do khác -> ẩn textarea
                    otherTextarea.style.display = 'none';
                }
            });
        });
    }
});

// ---- HÀM XÁC NHẬN HỦY ĐƠN ----
function confirmCancelOrder() {
    // Lấy orderId từ hidden input
    const orderId = document.getElementById('cancel-order-id').value;
    
    // Lấy radio button đang được chọn
    const selectedReason = document.querySelector('input[name="cancel-reason"]:checked');
    
    // ---- VALIDATE: PHẢI CHỌN LÝ DO ----
    if (!selectedReason) {
        showToast("Vui lòng chọn lý do hủy đơn hàng!", "warning");
        return;
    }
    
    // ---- XỬ LÝ LÝ DO ----
    let reason = selectedReason.value;
    
    // Nếu chọn "Khác" -> lấy text từ textarea
    if (reason === 'other') {
        reason = document.getElementById('cancel-reason-other').value.trim();
        if (!reason) {
            showToast("Vui lòng nhập lý do hủy đơn hàng!", "warning");
            return;
        }
    }
    
    // ---- GỌI API HỦY ĐƠN HÀNG ----
    // PATCH /api/orders/{orderId}/cancel
    fetch(`${apiUrl}/orders/${orderId}/cancel`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason })
    })
    .then((res) => res.json())
    .then((data) => {
        // Đóng modal
        closeCancelModal();
        
        // Hiển thị thông báo thành công
        showToast(data.message, "success");
        
        // Reload danh sách đơn hàng để cập nhật trạng thái
        fetchOrders();
        
        // Quay về list view (nếu đang ở detail view)
        backToOrderList();
    })
    .catch((err) => showToast("Lỗi khi hủy đơn!", "error"));
}

// =========================================================
// PHẦN 8: HÀM TIỆN ÍCH (UTILITIES)
// =========================================================

// ---- HÀM FORMAT TIỀN VIỆT NAM ----
// Chuyển số thành chuỗi tiền tệ VNĐ
// VD: 100000 -> "100.000 ₫"
function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN", { 
      style: "currency", 
      currency: "VND" 
  }).format(amount);
}

// =========================================================
// PHẦN 9: CHẠY KHỞI TẠO
// =========================================================
// Gọi hàm init ngay khi file được load
initUserPage();