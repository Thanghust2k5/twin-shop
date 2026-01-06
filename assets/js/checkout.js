// =========================================================
// FILE: assets/js/checkout.js
// =========================================================
// 
// CHỨC NĂNG: Xử lý logic trang thanh toán (checkout.html)
// 
// CÁC TÍNH NĂNG:
// 1. Hiển thị sản phẩm cần thanh toán (từ localStorage)
// 2. Quản lý địa chỉ nhận hàng (chọn, thêm, sửa)
// 3. Chọn đơn vị vận chuyển
// 4. Chọn phương thức thanh toán (COD hoặc Ví T-WinPay)
// 5. Tính tổng tiền và đặt hàng
// 
// DỮ LIỆU:
// - checkout_items: Sản phẩm được chọn từ giỏ hàng
// - user-addresses: Địa chỉ của user từ API
// - shipping: Phương thức vận chuyển từ API
// =========================================================

// =========================================================
// 1. KHỞI TẠO & STATE (Trạng thái ứng dụng)
// =========================================================

// Lấy thông tin user đang đăng nhập
const userLogin = safeJSONParse(localStorage.getItem("user_login"));
const currentUserId = userLogin ? userLogin.id : null;

/**
 * STATE - Object quản lý toàn bộ trạng thái của trang
 * 
 * Tại sao dùng state object?
 * - Dễ theo dõi và debug
 * - Tập trung dữ liệu ở một nơi
 * - Các hàm có thể truy cập và thay đổi state
 */
const state = {
    address: null,          // Địa chỉ nhận hàng đang được chọn
    addressList: [],        // Danh sách tất cả địa chỉ của user
    shippingMethods: [],    // Danh sách đơn vị vận chuyển (GHN, GHTK...)
    shippingId: null,       // ID của phương thức vận chuyển đang chọn
    paymentMethod: "COD",   // Phương thức thanh toán: "COD" hoặc "TWINPAY"
    walletBalance: 0,       // Số dư ví T-WinPay của user
    totalMoney: 0,          // Tổng tiền thanh toán (sản phẩm + ship)
    tempAddressId: null,    // ID địa chỉ tạm thời (trong modal chọn địa chỉ)
    tempShippingId: null,   // ID vận chuyển tạm thời (trong modal)
    editingAddressId: null  // ID địa chỉ đang sửa (null = đang thêm mới)
};

/**
 * Khởi tạo trang khi load xong
 * 
 * Sử dụng Promise.all để tải nhiều dữ liệu song song:
 * - Giúp trang load nhanh hơn
 * - Tất cả hoàn thành mới render sản phẩm
 */
window.onload = function () {
    // Kiểm tra đăng nhập
    if (!currentUserId) {
        alert("Bạn chưa đăng nhập!");
        window.location.href = "index.html";
        return;
    }

    // Tải dữ liệu song song để tối ưu tốc độ
    // Promise.all chờ tất cả hoàn thành rồi mới chạy .then()
    Promise.all([
        loadShippingMethods(),  // Tải danh sách ship
        loadUserAddresses(),    // Tải danh sách địa chỉ
        fetchUserBalance()      // Tải số dư ví
    ]).then(() => {
        renderCheckoutItems();  // Render sản phẩm sau khi có đủ dữ liệu
    });
};

// =========================================================
// 2. LOGIC SẢN PHẨM & TÍNH TIỀN
// =========================================================

/**
 * Render danh sách sản phẩm cần thanh toán
 * 
 * Dữ liệu lấy từ localStorage "checkout_items"
 * (được lưu bởi cart.js khi click "Mua hàng")
 */
function renderCheckoutItems() {
    // Lấy sản phẩm từ localStorage
    const cart = safeJSONParse(localStorage.getItem("checkout_items")) || [];
    const listWrapper = document.getElementById("checkout-list-wrapper");

    // Kiểm tra có sản phẩm không
    if (!listWrapper || cart.length === 0) {
        alert("Chưa chọn sản phẩm!");
        window.location.href = "cart.html";
        return;
    }

    let html = "";
    let totalProductMoney = 0;  // Tổng tiền hàng

    // Render từng sản phẩm
    cart.forEach((item) => {
        const rowTotal = item.price * item.quantity;
        totalProductMoney += rowTotal;
        
        const imgUrl = item.thumbnail || "https://via.placeholder.com/100";
        const variantText = (item.color || item.size) ? `${item.color || ''} ${item.size || ''}` : '-';

        html += `
            <div class="product-item">
                <div class="co-col-product">
                    <img src="${imgUrl}" class="co-img">
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <span class="co-name">${item.name}</span>
                        <span style="color: #888; font-size: 1.3rem; margin-top: 4px;">
                            Phân loại: ${variantText}
                        </span>
                    </div>
                </div>
                <div class="co-col-variant"></div>
                <div class="co-col-price">${formatCurrency(item.price)}</div>
                <div class="co-col-qnt">${item.quantity}</div>
                <div class="co-col-total">${formatCurrency(rowTotal)}</div>
            </div>
        `;
    });

    listWrapper.innerHTML = html;

    // ===== TÍNH TOÁN TỔNG TIỀN =====
    let shippingPrice = 0;
    // Tìm phương thức ship đang chọn để lấy giá
    const currentMethod = state.shippingMethods.find(s => s.id === state.shippingId);
    if (currentMethod) shippingPrice = parseFloat(currentMethod.price);

    // Tổng thanh toán = Tiền hàng + Phí ship
    state.totalMoney = totalProductMoney + shippingPrice;

    // Cập nhật giao diện Footer
    document.getElementById("sub-total").innerText = formatCurrency(totalProductMoney);
    document.getElementById("shipping-total").innerText = formatCurrency(shippingPrice);
    document.getElementById("final-total").innerText = formatCurrency(state.totalMoney);

    // Kiểm tra lại trạng thái ví (đủ tiền không?)
    checkWalletStatus();
}

// =========================================================
// 3. LOGIC VẬN CHUYỂN (SHIPPING)
// =========================================================

/**
 * Tải danh sách phương thức vận chuyển từ API
 * 
 * VD: GHN Express, GHTK, Viettel Post...
 * Mỗi phương thức có giá khác nhau
 */
function loadShippingMethods() {
    return fetch(`${apiUrl}/shipping`)
        .then(res => res.json())
        .then(data => {
            state.shippingMethods = data;
            
            // Mặc định chọn phương thức đầu tiên nếu chưa chọn
            if (state.shippingMethods.length > 0 && !state.shippingId) {
                state.shippingId = state.shippingMethods[0].id;
            }
            
            renderShippingInfo();
        })
        .catch(err => console.error("Lỗi lấy shipping:", err));
}

/**
 * Cập nhật thông tin vận chuyển lên giao diện
 * - Hiện tên và giá phương thức đang chọn
 * - Tính lại tổng tiền
 */
function renderShippingInfo() {
    const method = state.shippingMethods.find(s => s.id === state.shippingId);
    if (method) {
        // Cập nhật dòng hiển thị Shipping
        document.getElementById("shipping-method-name").innerText = method.name;
        document.getElementById("shipping-method-price").innerText = formatCurrency(method.price);
        
        // Tính lại tổng tiền (vì phí ship thay đổi)
        renderCheckoutItems();
    }
}

/**
 * Mở modal chọn đơn vị vận chuyển
 * Hiển thị danh sách các option dạng radio buttons
 */
function openShippingModal() {
    const list = document.getElementById("shipping-list-container");
    list.innerHTML = "";
    
    // Render từng phương thức vận chuyển
    state.shippingMethods.forEach(method => {
        const isChecked = method.id === state.shippingId ? "checked" : "";
        list.innerHTML += `
            <label class="shipping-item">
                <div class="shipping-item-left">
                    <input type="radio" name="shipping_radio" class="shipping-radio" value="${method.id}" ${isChecked} onclick="state.tempShippingId=${method.id}">
                    <span class="shipping-name">${method.name}</span>
                </div>
                <span class="shipping-price">${formatCurrency(method.price)}</span>
            </label>
        `;
    });
    
    // Lưu lựa chọn tạm thời
    state.tempShippingId = state.shippingId;
    document.getElementById("modal-shipping").style.display = "flex";
}

/**
 * Xác nhận chọn phương thức vận chuyển
 * Cập nhật state và đóng modal
 */
function confirmSelectShipping() {
    if (state.tempShippingId) {
        state.shippingId = state.tempShippingId;
        renderShippingInfo();
        document.getElementById("modal-shipping").style.display = "none";
    }
}

// =========================================================
// 4. LOGIC ĐỊA CHỈ (ADDRESS)
// =========================================================

/**
 * Tải danh sách địa chỉ của user từ API
 * Mỗi user có thể có nhiều địa chỉ, 1 địa chỉ mặc định
 */
function loadUserAddresses() {
    return fetch(`${apiUrl}/user-addresses/${currentUserId}`)
        .then(res => res.json())
        .then(data => {
            state.addressList = data;
            
            // Chọn địa chỉ mặc định nếu có
            if (state.addressList.length > 0 && !state.address) {
                state.address = state.addressList.find(a => a.is_default === 1) || state.addressList[0];
            }
            
            renderSelectedAddress();
        });
}

/**
 * Render địa chỉ đang được chọn lên giao diện
 * Hiện tên, số điện thoại, địa chỉ chi tiết
 */
function renderSelectedAddress() {
    if (!state.address) {
        // Chưa có địa chỉ nào → hiện nút thêm
        document.getElementById("selected-address-box").style.display = "none";
        document.getElementById("no-address-box").style.display = "block";
        return;
    }
    
    // Có địa chỉ → hiện thông tin
    document.getElementById("selected-address-box").style.display = "flex";
    document.getElementById("no-address-box").style.display = "none";
    document.getElementById("addr-name-phone").innerText = `${state.address.recipient_name} ${state.address.recipient_phone}`;
    document.getElementById("addr-detail").innerText = state.address.address;
    
    // Hiện badge "Mặc định" nếu là địa chỉ mặc định
    document.getElementById("addr-default-badge").style.display = state.address.is_default ? "block" : "none";
}

/**
 * Mở modal danh sách địa chỉ để chọn
 * Hiển thị tất cả địa chỉ dạng radio buttons
 */
function openAddressModal() {
    const listContainer = document.getElementById("address-list-container");
    listContainer.innerHTML = "";

    // Render từng địa chỉ
    state.addressList.forEach((addr) => {
        const isChecked = state.address && state.address.id === addr.id ? "checked" : "";
        const defaultLabel = addr.is_default ? '<span style="color:#ee4d2d; border:1px solid #ee4d2d; font-size:12px; padding:1px 4px; margin-left:10px;">Mặc định</span>' : "";

        listContainer.innerHTML += `
            <div style="display: flex; align-items: flex-start; padding: 20px 0; border-bottom: 1px solid #f1f1f1;">
                <input type="radio" name="address_radio" value="${addr.id}" ${isChecked} style="margin-top: 4px; transform: scale(1.2);" onclick="state.tempAddressId = ${addr.id}">
                <div style="margin-left: 15px; flex: 1;">
                    <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span style="font-size: 1.6rem; font-weight: 500; color: #333;">${addr.recipient_name}</span>
                            <span style="font-size: 1.4rem; color: #777; margin-left: 8px; border-left: 1px solid #ddd; padding-left: 8px;">${addr.recipient_phone}</span>
                        </div>
                        <span style="color: #05a; font-size: 1.4rem; cursor: pointer; font-weight: 500;" onclick="showEditAddressForm(${addr.id})">Cập nhật</span>
                    </div>
                    <div style="font-size: 1.4rem; color: #666; margin-top: 5px; line-height: 1.6;">${addr.address}</div>
                    <div style="margin-top: 5px;">${defaultLabel}</div>
                </div>
            </div>
        `;
    });

    if (state.address) state.tempAddressId = state.address.id;
    document.getElementById("modal-address").style.display = "flex";
}

/**
 * Đóng modal địa chỉ
 */
function closeAddressModal() {
    document.getElementById("modal-address").style.display = "none";
}

/**
 * Hàm global closeModal - Được gọi từ overlay HTML
 * (Để tương thích với cách gọi từ HTML)
 */
function closeModal() {
    closeAddressModal();
}

/**
 * Xác nhận chọn địa chỉ
 * Cập nhật địa chỉ đang dùng và đóng modal
 */
function confirmSelectAddress() {
    if (state.tempAddressId) {
        state.address = state.addressList.find(a => a.id === state.tempAddressId);
        renderSelectedAddress();
        closeAddressModal();
    }
}

// =========================================================
// 4.1. THÊM / SỬA ĐỊA CHỈ
// =========================================================

/**
 * Mở form thêm địa chỉ mới
 * Reset form và chuyển sang modal thêm địa chỉ
 */
function showAddAddressForm() {
    state.editingAddressId = null;  // Mode: Thêm mới
    resetAddressForm();
    document.querySelector("#modal-add-address .auth-form__heading").innerText = "Địa Chỉ Mới";
    
    closeAddressModal();  // Đóng modal danh sách
    document.getElementById("modal-add-address").style.display = "flex";  // Mở modal form
}

/**
 * Mở form sửa địa chỉ
 * @param {number} id - ID của địa chỉ cần sửa
 */
function showEditAddressForm(id) {
    const addr = state.addressList.find(a => a.id === id);
    if (!addr) return;

    state.editingAddressId = id;  // Mode: Sửa
    
    // Điền thông tin vào form
    document.getElementById("new-name").value = addr.recipient_name;
    document.getElementById("new-phone").value = addr.recipient_phone;
    document.getElementById("new-default").checked = (addr.is_default === 1);

    // Tách địa chỉ thành 2 phần: Địa chỉ cụ thể và Tỉnh/Thành phố
    const fullAddr = addr.address || "";
    const commaIndex = fullAddr.indexOf(',');
    if (commaIndex !== -1) {
        document.getElementById("new-specific").value = fullAddr.substring(0, commaIndex).trim();
        document.getElementById("new-addr").value = fullAddr.substring(commaIndex + 1).trim();
    } else {
        document.getElementById("new-addr").value = fullAddr;
    }

    document.querySelector("#modal-add-address .auth-form__heading").innerText = "Cập nhật địa chỉ";
    
    closeAddressModal();
    document.getElementById("modal-add-address").style.display = "flex";
}

/**
 * Quay lại danh sách địa chỉ từ form thêm/sửa
 */
function backToAddressList() {
    document.getElementById("modal-add-address").style.display = "none";
    openAddressModal();  // Quay lại danh sách
}

/**
 * Lưu địa chỉ mới hoặc cập nhật địa chỉ đã sửa
 * 
 * Tự động nhận biết mode (thêm/sửa) qua state.editingAddressId
 * - Nếu null: POST (thêm mới)
 * - Nếu có ID: PUT (cập nhật)
 */
function saveNewAddress() {
    // Lấy các input
    const nameInput = document.getElementById("new-name");
    const phoneInput = document.getElementById("new-phone");
    const cityInput = document.getElementById("new-addr");
    const specificInput = document.getElementById("new-specific");
    const isDefault = document.getElementById("new-default").checked;
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const city = cityInput.value.trim();
    const specific = specificInput.value.trim();

    // ===== VALIDATE =====
    let isValid = true;
    
    // Validate tên người nhận
    const nameResult = Validator.validateFullName(name);
    if (!nameResult.isValid) {
        Validator.showError(nameInput, nameResult.message);
        isValid = false;
    } else {
        Validator.clearError(nameInput);
    }
    
    // Validate số điện thoại
    const phoneResult = Validator.validatePhone(phone);
    if (!phoneResult.isValid) {
        Validator.showError(phoneInput, phoneResult.message);
        isValid = false;
    } else {
        Validator.clearError(phoneInput);
    }
    
    // Validate địa chỉ (thành phố/quận/huyện) - không được rỗng
    if (!city) {
        Validator.showError(cityInput, 'Vui lòng nhập Tỉnh/Thành phố, Quận/Huyện!');
        isValid = false;
    } else {
        Validator.clearError(cityInput);
    }
    
    if (!isValid) return;

    // Ghép địa chỉ đầy đủ
    const finalAddr = specific ? `${specific}, ${city}` : city;
    
    // Xác định method và URL dựa trên mode (thêm/sửa)
    const method = state.editingAddressId ? "PUT" : "POST";
    const url = state.editingAddressId 
        ? `${apiUrl}/user-addresses/${state.editingAddressId}` 
        : `${apiUrl}/user-addresses`;

    // Gọi API
    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, name, phone, address: finalAddr, isDefault })
    })
    .then(res => { if (!res.ok) throw new Error("Lỗi Server"); return res.text(); })
    .then(() => {
        backToAddressList();  // Đóng form
        loadUserAddresses().then(() => openAddressModal());  // Load lại và mở list
        state.editingAddressId = null;
    })
    .catch(err => alert("Có lỗi xảy ra: " + err));
}

/**
 * Reset form địa chỉ về trống
 */
function resetAddressForm() {
    document.getElementById("new-name").value = "";
    document.getElementById("new-phone").value = "";
    document.getElementById("new-addr").value = "";
    document.getElementById("new-specific").value = "";
    document.getElementById("new-default").checked = false;
}

// =========================================================
// 5. THANH TOÁN (PAYMENT & WALLET)
// =========================================================

/**
 * Lấy số dư ví T-WinPay của user
 * Cập nhật state.walletBalance và kiểm tra đủ tiền không
 */
function fetchUserBalance() {
    fetch(`${apiUrl}/users/${currentUserId}`)
        .then(res => res.json())
        .then(data => {
            state.walletBalance = data.wallet_balance ? parseFloat(data.wallet_balance) : 0;
            
            // Hiển thị số dư ví trên giao diện
            const el = document.getElementById("wallet-balance-display");
            if(el) el.innerText = formatCurrency(state.walletBalance);
            
            // Kiểm tra đủ tiền thanh toán không
            checkWalletStatus();
        })
        .catch(err => console.error(err));
}

/**
 * Kiểm tra trạng thái ví có đủ thanh toán không
 * 
 * Nếu không đủ:
 * - Thêm class "insufficient" (hiện cảnh báo)
 * - Disable radio button
 */
function checkWalletStatus() {
    const box = document.getElementById("twinpay-option-box");
    const radio = document.getElementById("twinpay-check");
    if (!box || !radio) return;

    if (state.walletBalance < state.totalMoney) {
        // Không đủ tiền → thêm class insufficient
        box.classList.add("insufficient");
        radio.disabled = true;
        radio.checked = false;
        box.classList.remove("active");
    } else {
        // Đủ tiền → bỏ class insufficient
        box.classList.remove("insufficient");
        radio.disabled = false;
    }
}

/**
 * Xử lý khi click vào option thanh toán T-WinPay
 * 
 * Kiểm tra đủ tiền không trước khi cho chọn
 */
function handleTwinPayClick(event) {
    event.preventDefault();  // Chặn click mặc định
    
    // Kiểm tra đủ tiền không
    if (state.walletBalance < state.totalMoney) {
        const missing = state.totalMoney - state.walletBalance;
        showWarningModal(`Số dư Ví T-WinPay không đủ (Thiếu ${formatCurrency(missing)}).<br>Vui lòng nạp thêm để thanh toán.`);
        return;
    }

    // Đủ tiền → Active option
    const radio = document.getElementById("twinpay-check");
    const box = document.getElementById("twinpay-option-box");
    radio.checked = true;
    box.classList.add("active");
    
    selectPayment(null, 'TWINPAY');
}

/**
 * Chuyển đổi phương thức thanh toán
 * 
 * @param {HTMLElement|null} btn - Nút được click (hoặc null nếu gọi từ code)
 * @param {string} method - Phương thức: "COD" hoặc "TWINPAY"
 */
function selectPayment(btn, method) {
    // Cập nhật UI: Bỏ active tất cả nút, thêm active cho nút được chọn
    document.querySelectorAll(".payment-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    else if (method === 'TWINPAY') {
        // Nếu gọi từ handleTwinPayClick (btn = null), tìm nút Ví để active
        const twinBtn = document.querySelector("button[onclick*='TWINPAY']");
        if(twinBtn) twinBtn.classList.add("active");
    }

    // Cập nhật state
    state.paymentMethod = method;

    // Lấy các element content
    const codContent = document.getElementById("payment-cod-content");
    const twinContent = document.getElementById("payment-twinpay-content");
    const twinBox = document.getElementById("twinpay-option-box");
    const twinRadio = document.getElementById("twinpay-check");

    // Hiện/ẩn nội dung tương ứng
    if (method === 'COD') {
        codContent.style.display = "block";
        twinContent.style.display = "none";
        if(twinRadio) twinRadio.checked = false;
        if(twinBox) twinBox.classList.remove("active");
    } else if (method === 'TWINPAY') {
        codContent.style.display = "none";
        twinContent.style.display = "block";
        checkWalletStatus();
        // Tự động active nếu đủ tiền
        if (state.walletBalance >= state.totalMoney) {
            if(twinBox) twinBox.classList.add("active");
            if(twinRadio) twinRadio.checked = true;
        }
    }
}

// =========================================================
// 6. ĐẶT HÀNG (ORDER)
// =========================================================

/**
 * Xác nhận và đặt hàng
 * 
 * Luồng xử lý:
 * 1. Kiểm tra đã chọn địa chỉ chưa
 * 2. Kiểm tra đủ tiền nếu dùng ví
 * 3. Thu thập dữ liệu đơn hàng
 * 4. Gọi API tạo đơn hàng
 * 5. Thành công → chuyển đến trang đơn hàng
 */
function confirmOrder() {
    // Kiểm tra địa chỉ
    if (!state.address) {
        alert("Vui lòng chọn địa chỉ nhận hàng!");
        openAddressModal();
        return;
    }
    
    // Kiểm tra đủ tiền nếu dùng T-WinPay
    if (state.paymentMethod === 'TWINPAY' && state.walletBalance < state.totalMoney) {
        showWarningModal("Số dư ví không đủ để thanh toán!");
        return;
    }

    // Thu thập dữ liệu đơn hàng
    const items = safeJSONParse(localStorage.getItem("checkout_items")) || [];
    const note = document.getElementById("order-note") ? document.getElementById("order-note").value.trim() : "";

    const orderData = {
        userId: currentUserId,
        recipientName: state.address.recipient_name,
        recipientPhone: state.address.recipient_phone,
        recipientAddress: state.address.address,
        totalMoney: state.totalMoney,
        items: items,
        paymentMethod: state.paymentMethod,
        note: note,
        shippingId: state.shippingId
    };

    // Gọi API đặt hàng
    fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        // Nếu dùng ví → trừ tiền trên UI
        if (state.paymentMethod === 'TWINPAY') {
            state.walletBalance -= state.totalMoney;
            const balEl = document.getElementById("wallet-balance-display");
            if(balEl) balEl.innerText = formatCurrency(state.walletBalance);
        }

        // Thông báo thành công
        alert("✅ Đặt hàng thành công! Mã đơn: " + data.orderId);
        
        // Xóa sản phẩm checkout khỏi localStorage
        localStorage.removeItem("checkout_items");
        
        // Chuyển đến trang đơn hàng
        window.location.href = "user.html?tab=orders";
    })
    .catch(err => {
        console.error(err);
        alert("Đặt hàng thất bại: " + err.message);
    });
}

// =========================================================
// 7. HELPER FUNCTIONS
// =========================================================

/**
 * Format số thành tiền VNĐ
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

/**
 * Hiện modal cảnh báo
 * @param {string} msg - Thông báo HTML
 */
function showWarningModal(msg) {
    document.getElementById("warning-msg").innerHTML = msg;
    document.getElementById("modal-warning").style.display = "flex";
}

/**
 * Đóng modal cảnh báo
 */
function closeWarningModal() {
    document.getElementById("modal-warning").style.display = "none";
}