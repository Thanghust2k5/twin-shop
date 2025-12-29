// =========================================================
// FILE: assets/js/checkout.js
// Mô tả: Xử lý logic thanh toán, địa chỉ, vận chuyển, ví T-WinPay
// =========================================================

// --- 1. KHỞI TẠO & STATE ---
const userLogin = safeJSONParse(localStorage.getItem("user_login"));
const currentUserId = userLogin ? userLogin.id : null;

// State quản lý toàn bộ dữ liệu trang
const state = {
    address: null,          // Địa chỉ nhận hàng hiện tại
    addressList: [],        // Danh sách địa chỉ
    shippingMethods: [],    // Danh sách đơn vị vận chuyển
    shippingId: null,       // ID vận chuyển đang chọn
    paymentMethod: "COD",   // Phương thức thanh toán
    walletBalance: 0,       // Số dư ví
    totalMoney: 0,          // Tổng tiền thanh toán
    tempAddressId: null,    // ID địa chỉ tạm (trong modal)
    tempShippingId: null,   // ID vận chuyển tạm (trong modal)
    editingAddressId: null  // ID địa chỉ đang sửa (null = thêm mới)
};

// Chạy khi tải trang
window.onload = function () {
    if (!currentUserId) {
        alert("Bạn chưa đăng nhập!");
        window.location.href = "index.html";
        return;
    }

    // Tải dữ liệu song song để tối ưu tốc độ
    Promise.all([
        loadShippingMethods(),
        loadUserAddresses(),
        fetchUserBalance()
    ]).then(() => {
        renderCheckoutItems(); // Render sản phẩm sau khi có đủ dữ liệu ship
    });
};

// =========================================================
// 2. LOGIC SẢN PHẨM & TÍNH TIỀN
// =========================================================
function renderCheckoutItems() {
    const cart = safeJSONParse(localStorage.getItem("checkout_items")) || [];
    const listWrapper = document.getElementById("checkout-list-wrapper");

    if (!listWrapper || cart.length === 0) {
        alert("Chưa chọn sản phẩm!");
        window.location.href = "cart.html";
        return;
    }

    let html = "";
    let totalProductMoney = 0;

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

    // --- TÍNH TOÁN TỔNG TIỀN ---
    let shippingPrice = 0;
    const currentMethod = state.shippingMethods.find(s => s.id === state.shippingId);
    if (currentMethod) shippingPrice = parseFloat(currentMethod.price);

    state.totalMoney = totalProductMoney + shippingPrice;

    // Cập nhật UI Footer
    document.getElementById("sub-total").innerText = formatCurrency(totalProductMoney);
    document.getElementById("shipping-total").innerText = formatCurrency(shippingPrice);
    document.getElementById("final-total").innerText = formatCurrency(state.totalMoney);

    // Check lại ví nếu tổng tiền thay đổi
    checkWalletStatus();
}

// =========================================================
// 3. LOGIC VẬN CHUYỂN (SHIPPING)
// =========================================================
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

// Cập nhật thông tin Ship lên giao diện (Dòng ngang & Footer)
function renderShippingInfo() {
    const method = state.shippingMethods.find(s => s.id === state.shippingId);
    if (method) {
        // Cập nhật dòng Shipping Info
        document.getElementById("shipping-method-name").innerText = method.name;
        document.getElementById("shipping-method-price").innerText = formatCurrency(method.price);
        
        // Tính lại tổng tiền
        renderCheckoutItems();
    }
}

function openShippingModal() {
    const list = document.getElementById("shipping-list-container");
    list.innerHTML = "";
    
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
    
    state.tempShippingId = state.shippingId;
    document.getElementById("modal-shipping").style.display = "flex";
}

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
function loadUserAddresses() {
    return fetch(`${apiUrl}/user-addresses/${currentUserId}`)
        .then(res => res.json())
        .then(data => {
            state.addressList = data;
            // Chọn mặc định
            if (state.addressList.length > 0 && !state.address) {
                state.address = state.addressList.find(a => a.is_default === 1) || state.addressList[0];
            }
            renderSelectedAddress();
        });
}

function renderSelectedAddress() {
    if (!state.address) {
        document.getElementById("selected-address-box").style.display = "none";
        document.getElementById("no-address-box").style.display = "block";
        return;
    }
    document.getElementById("selected-address-box").style.display = "flex";
    document.getElementById("no-address-box").style.display = "none";
    document.getElementById("addr-name-phone").innerText = `${state.address.recipient_name} ${state.address.recipient_phone}`;
    document.getElementById("addr-detail").innerText = state.address.address;
    document.getElementById("addr-default-badge").style.display = state.address.is_default ? "block" : "none";
}

function openAddressModal() {
    const listContainer = document.getElementById("address-list-container");
    listContainer.innerHTML = "";

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

// Xử lý đóng Modal Address (từ nút Hủy hoặc Overlay)
function closeAddressModal() {
    document.getElementById("modal-address").style.display = "none";
}

// Hàm global closeModal (Được gọi từ overlay HTML)
// Đóng modal địa chỉ để tránh conflict
function closeModal() {
    closeAddressModal();
}

function confirmSelectAddress() {
    if (state.tempAddressId) {
        state.address = state.addressList.find(a => a.id === state.tempAddressId);
        renderSelectedAddress();
        closeAddressModal();
    }
}

// --- THÊM / SỬA ĐỊA CHỈ ---
function showAddAddressForm() {
    state.editingAddressId = null; // Mode: Thêm
    resetAddressForm();
    document.querySelector("#modal-add-address .auth-form__heading").innerText = "Địa Chỉ Mới";
    
    closeAddressModal(); // Đóng list
    document.getElementById("modal-add-address").style.display = "flex"; // Mở form
}

function showEditAddressForm(id) {
    const addr = state.addressList.find(a => a.id === id);
    if (!addr) return;

    state.editingAddressId = id; // Mode: Sửa
    document.getElementById("new-name").value = addr.recipient_name;
    document.getElementById("new-phone").value = addr.recipient_phone;
    document.getElementById("new-default").checked = (addr.is_default === 1);

    // Tách địa chỉ (Specific, Admin)
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

function backToAddressList() {
    document.getElementById("modal-add-address").style.display = "none";
    openAddressModal(); // Quay lại danh sách
}

function saveNewAddress() {
    const nameInput = document.getElementById("new-name");
    const phoneInput = document.getElementById("new-phone");
    const cityInput = document.getElementById("new-addr");
    const specificInput = document.getElementById("new-specific");
    const isDefault = document.getElementById("new-default").checked;
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const city = cityInput.value.trim();
    const specific = specificInput.value.trim();

    // Validate với Validator
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
    
    // Validate địa chỉ (thành phố/quận/huyện)
    if (!city) {
        Validator.showError(cityInput, 'Vui lòng nhập Tỉnh/Thành phố, Quận/Huyện!');
        isValid = false;
    } else {
        Validator.clearError(cityInput);
    }
    
    if (!isValid) return;

    const finalAddr = specific ? `${specific}, ${city}` : city;
    const method = state.editingAddressId ? "PUT" : "POST";
    const url = state.editingAddressId 
        ? `${apiUrl}/user-addresses/${state.editingAddressId}` 
        : `${apiUrl}/user-addresses`;

    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, name, phone, address: finalAddr, isDefault })
    })
    .then(res => { if (!res.ok) throw new Error("Lỗi Server"); return res.text(); })
    .then(() => {
        backToAddressList(); // Quay lại list sau khi lưu
        loadUserAddresses().then(() => openAddressModal()); // Load lại list mới
        state.editingAddressId = null;
    })
    .catch(err => alert("Có lỗi xảy ra: " + err));
}

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
function fetchUserBalance() {
    fetch(`${apiUrl}/users/${currentUserId}`)
        .then(res => res.json())
        .then(data => {
            state.walletBalance = data.wallet_balance ? parseFloat(data.wallet_balance) : 0;
            const el = document.getElementById("wallet-balance-display");
            if(el) el.innerText = formatCurrency(state.walletBalance);
            checkWalletStatus();
        })
        .catch(err => console.error(err));
}

function checkWalletStatus() {
    const box = document.getElementById("twinpay-option-box");
    const radio = document.getElementById("twinpay-check");
    if (!box || !radio) return;

    if (state.walletBalance < state.totalMoney) {
        box.classList.add("insufficient");
        radio.disabled = true;
        radio.checked = false;
        box.classList.remove("active");
        
    } else {
        box.classList.remove("insufficient");
        radio.disabled = false;
    }
}

function handleTwinPayClick(event) {
    event.preventDefault(); // Chặn click mặc định để xử lý logic
    
    if (state.walletBalance < state.totalMoney) {
        const missing = state.totalMoney - state.walletBalance;
        showWarningModal(`Số dư Ví T-WinPay không đủ (Thiếu ${formatCurrency(missing)}).<br>Vui lòng nạp thêm để thanh toán.`);
        return;
    }

    // Nếu đủ tiền -> Active
    const radio = document.getElementById("twinpay-check");
    const box = document.getElementById("twinpay-option-box");
    radio.checked = true;
    box.classList.add("active");
    
    selectPayment(null, 'TWINPAY');
}

function selectPayment(btn, method) {
    // UI Button Tabs
    document.querySelectorAll(".payment-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    else if (method === 'TWINPAY') {
        // Nếu gọi từ handleTwinPayClick (btn = null), tìm nút Ví để active
        const twinBtn = document.querySelector("button[onclick*='TWINPAY']");
        if(twinBtn) twinBtn.classList.add("active");
    }

    state.paymentMethod = method;

    const codContent = document.getElementById("payment-cod-content");
    const twinContent = document.getElementById("payment-twinpay-content");
    const twinBox = document.getElementById("twinpay-option-box");
    const twinRadio = document.getElementById("twinpay-check");

    if (method === 'COD') {
        codContent.style.display = "block";
        twinContent.style.display = "none";
        if(twinRadio) twinRadio.checked = false;
        if(twinBox) twinBox.classList.remove("active");
    } else if (method === 'TWINPAY') {
        codContent.style.display = "none";
        twinContent.style.display = "block";
        checkWalletStatus();
        if (state.walletBalance >= state.totalMoney) {
            if(twinBox) twinBox.classList.add("active");
            if(twinRadio) twinRadio.checked = true;
        }
    }
}

// =========================================================
// 6. ĐẶT HÀNG (ORDER)
// =========================================================
function confirmOrder() {
    if (!state.address) {
        alert("Vui lòng chọn địa chỉ nhận hàng!");
        openAddressModal();
        return;
    }
    if (state.paymentMethod === 'TWINPAY' && state.walletBalance < state.totalMoney) {
        showWarningModal("Số dư ví không đủ để thanh toán!");
        return;
    }

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

    fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        // Trừ tiền ảo trên UI nếu dùng Ví
        if (state.paymentMethod === 'TWINPAY') {
            state.walletBalance -= state.totalMoney;
            const balEl = document.getElementById("wallet-balance-display");
            if(balEl) balEl.innerText = formatCurrency(state.walletBalance);
        }

        alert("✅ Đặt hàng thành công! Mã đơn: " + data.orderId);
        localStorage.removeItem("checkout_items");
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
function formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function showWarningModal(msg) {
    document.getElementById("warning-msg").innerHTML = msg;
    document.getElementById("modal-warning").style.display = "flex";
}

function closeWarningModal() {
    document.getElementById("modal-warning").style.display = "none";
}