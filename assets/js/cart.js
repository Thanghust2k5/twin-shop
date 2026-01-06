// =========================================================
// FILE: assets/js/cart.js
// =========================================================
// 
// CHỨC NĂNG: Quản lý trang giỏ hàng (cart.html)
// 
// CÁC TÍNH NĂNG:
// 1. Hiển thị danh sách sản phẩm trong giỏ
// 2. Thay đổi số lượng (+/-)
// 3. Chọn/bỏ chọn sản phẩm
// 4. Xóa sản phẩm
// 5. Thanh toán (chuyển sang checkout)
// 
// DỮ LIỆU:
// - Lấy từ API /cart/:userId
// - Lưu tạm vào biến myCartData để thao tác
// =========================================================

// ===== BIẾN TOÀN CỤC =====
// Lấy thông tin user từ localStorage
const userCartLogin = safeJSONParse(localStorage.getItem("user_login"));
// Lấy userId để gọi API (nếu chưa đăng nhập sẽ là null)
const userIdCart = userCartLogin ? userCartLogin.id : null;
// Mảng lưu dữ liệu giỏ hàng hiện tại
let myCartData = [];

// =========================================================
// 1. KHỞI TẠO TRANG GIỎ HÀNG
// =========================================================

/**
 * Khởi tạo trang giỏ hàng
 * - Kiểm tra đăng nhập
 * - Gọi API lấy giỏ hàng
 * - Render giao diện
 */
function initCartPage() {
    // Chưa đăng nhập → hiện thông báo
    if (!userIdCart) {
        const wrapper = document.getElementById("cart-list-wrapper");
        if (wrapper) wrapper.innerHTML = getEmptyCartHTML("Vui lòng đăng nhập để xem giỏ hàng");
        return;
    }

    // Gọi API lấy giỏ hàng của user
    fetch(`${apiUrl}/cart/${userIdCart}`)
        .then(res => res.json())
        .then(data => {
            myCartData = data;  // Lưu vào biến toàn cục
            renderCartPage(myCartData);  // Render giao diện
            updateFooterInfo();  // Cập nhật tổng tiền
        })
        .catch(err => console.error(err));
}

// =========================================================
// 2. RENDER GIAO DIỆN GIỎ HÀNG
// =========================================================

/**
 * Render danh sách sản phẩm trong giỏ
 * 
 * @param {Array} cartItems - Mảng các sản phẩm trong giỏ
 * 
 * Mỗi item sẽ có:
 * - Checkbox để chọn
 * - Ảnh + tên sản phẩm
 * - Phân loại (màu, size)
 * - Giá đơn vị
 * - Số lượng (có nút +/-)
 * - Thành tiền
 * - Nút xóa
 */
function renderCartPage(cartItems) {
    const cartList = document.getElementById("cart-list-wrapper");
    if (!cartList) return;

    // Giỏ hàng trống
    if (cartItems.length === 0) {
        cartList.innerHTML = getEmptyCartHTML("Giỏ hàng của bạn còn trống");
        const footer = document.querySelector(".cart-footer");
        if(footer) footer.style.display = "none";
        return;
    } else {
        // Có sản phẩm → hiện footer
        const footer = document.querySelector(".cart-footer");
        if(footer) footer.style.display = "flex";
    }

    // Map mỗi item thành HTML row
    const htmls = cartItems.map((item, index) => {
        // Tính thành tiền = đơn giá × số lượng
        const itemTotal = item.price * item.quantity;
        const imgUrl = item.thumbnail || "https://via.placeholder.com/100";
        
        // Xây dựng text phân loại
        const variantText = (item.color || item.size) 
            ? `Phân loại: ${item.color || ''}, ${item.size || ''}` 
            : 'Phân loại: Mặc định';
        
        const hasVariant = !!(item.color || item.size);

        return `
            <div class="cart-item" id="item-${item.id}">
                <!-- Cột 0: Checkbox chọn sản phẩm -->
                <div class="cart-col-0">
                    <input type="checkbox" class="cart-item-checkbox" 
                        data-id="${item.id}" 
                        data-price="${item.price}" 
                        data-qty="${item.quantity}"
                        onchange="updateFooterInfo()">
                </div>
                
                <!-- Cột 1: Ảnh + Tên sản phẩm -->
                <div class="cart-col-1">
                    <img src="${imgUrl}" class="cart-img">
                    <a href="product-detail.html?id=${item.product_id}" class="cart-name">${item.name}</a>
                </div>

                <!-- Cột Phân loại: Màu, Size -->
                <div class="cart-col-variant">
                    ${hasVariant ? `
                        <div class="cart-variant-wrap" onclick="toggleVariantPopup(${index})">
                            <span class="cart-variant-label">${variantText}</span>
                            <i class="fas fa-caret-down cart-variant-icon"></i>
                            
                            <!-- Popup thay đổi phân loại (demo) -->
                            <div class="cart-variant-popup" id="popup-${index}" onclick="event.stopPropagation()">
                                <div class="cart-popup-group">
                                    <span class="cart-popup-label">Màu Sắc (Demo)</span>
                                    <button class="cart-popup-btn active">${item.color}</button>
                                    <button class="cart-popup-btn">Khác...</button>
                                </div>
                                <div class="cart-popup-group">
                                    <span class="cart-popup-label">Size (Demo)</span>
                                    <button class="cart-popup-btn active">${item.size}</button>
                                    <button class="cart-popup-btn">Khác...</button>
                                </div>
                                <div class="cart-popup-actions">
                                    <button class="btn-popup-cancel" onclick="toggleVariantPopup(${index})">Trở lại</button>
                                    <button class="btn-popup-confirm" onclick="toggleVariantPopup(${index})">Xác nhận</button>
                                </div>
                            </div>
                        </div>
                    ` : '<span style="color:#ccc;">-</span>'}
                </div>

                <!-- Cột 2: Đơn giá -->
                <div class="cart-col-2">${formatCurrency(item.price)}</div>
                
                <!-- Cột 3: Số lượng với nút +/- -->
                <div class="cart-col-3">
                    <div class="cart-qnt-box">
                        <button class="cart-btn-qnt" onclick="updateQuantity(${item.id}, ${index}, -1)">-</button>
                        
                        <input type="number" class="cart-qnt-input" 
                               value="${item.quantity}" 
                               onkeydown="if(['e', 'E', '+', '-', '.'].includes(event.key)) event.preventDefault()"
                               onchange="onInputQuantityChange(this, ${item.id}, ${index})">
                               
                        <button class="cart-btn-qnt" onclick="updateQuantity(${item.id}, ${index}, 1)">+</button>
                    </div>
                </div>

                <!-- Cột 4: Thành tiền -->
                <div class="cart-col-4" id="total-${item.id}">${formatCurrency(itemTotal)}</div>
                
                <!-- Cột 5: Nút xóa -->
                <div class="cart-col-5">
                    <span onclick="deleteSelectedItems([${item.id}])" class="btn-delete">Xóa</span>
                </div>
            </div>
        `;
    });
    
    cartList.innerHTML = htmls.join("");
}

// =========================================================
// 3. XỬ LÝ SỐ LƯỢNG (+/-)
// =========================================================

/**
 * Thay đổi số lượng sản phẩm
 * 
 * @param {number} cartId - ID của cart item
 * @param {number} index - Vị trí trong mảng myCartData
 * @param {number} change - Số lượng thay đổi (+1 hoặc -1)
 */
function updateQuantity(cartId, index, change) {
    const item = myCartData[index];
    let newQty = item.quantity + change;
    
    // Không cho phép số lượng < 1
    if (newQty < 1) return;

    // Gọi API cập nhật số lượng
    fetch(`${apiUrl}/cart/update/${cartId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty })
    })
    .then(res => res.json())
    .then(() => {
        // Cập nhật dữ liệu local
        item.quantity = newQty;
        
        // Cập nhật giao diện
        const row = document.getElementById(`item-${cartId}`);
        row.querySelector(".cart-qnt-input").value = newQty;
        
        // Tính lại thành tiền
        const newTotal = newQty * item.price;
        document.getElementById(`total-${cartId}`).innerText = formatCurrency(newTotal);

        // Cập nhật data attribute cho checkbox
        row.querySelector(".cart-item-checkbox").dataset.qty = newQty;
        
        // Cập nhật tổng tiền ở footer
        updateFooterInfo();
    });
}

/**
 * Xử lý khi user gõ trực tiếp số lượng vào input
 */
function onInputQuantityChange(input, cartId, index) {
    let newQty = parseInt(input.value);
    // Validate input
    if (!newQty || newQty < 1) newQty = 1;
    
    // Tính sự thay đổi so với số lượng hiện tại
    const currentQty = myCartData[index].quantity;
    updateQuantity(cartId, index, newQty - currentQty);
}

// =========================================================
// 4. CHỨC NĂNG CHỌN TẤT CẢ (CHECK ALL)
// =========================================================

/**
 * Toggle chọn/bỏ chọn tất cả sản phẩm
 * 
 * @param {HTMLElement} sourceCheckbox - Checkbox vừa được click
 * 
 * Lưu ý: Có 2 nút "Chọn tất cả":
 * - 1 ở header (check-all)
 * - 1 ở footer (check-all-footer)
 * Cả 2 cần được đồng bộ
 */
function toggleCheckAll(sourceCheckbox) {
    // Lấy trạng thái checked của nút vừa bấm
    const isChecked = sourceCheckbox.checked;
    
    // Đồng bộ cả 2 nút (Trên đầu và Dưới chân)
    const headerCheck = document.getElementById("check-all");
    const footerCheck = document.getElementById("check-all-footer");
    
    if(headerCheck) headerCheck.checked = isChecked;
    if(footerCheck) footerCheck.checked = isChecked;

    // Chọn/bỏ chọn tất cả các item con
    document.querySelectorAll(".cart-item-checkbox").forEach(box => {
        box.checked = isChecked;
    });
    
    // Cập nhật tổng tiền
    updateFooterInfo();
}

/**
 * Cập nhật thông tin footer (tổng tiền, số lượng đã chọn)
 * 
 * Cũng tự động check/uncheck nút "Chọn tất cả"
 * dựa trên việc có chọn hết sản phẩm hay không
 */
function updateFooterInfo() {
    // Lấy tất cả checkbox đang được check
    const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
    let total = 0;
    let count = 0;

    // Tính tổng tiền từ các item đã chọn
    checkedBoxes.forEach(box => {
        const price = parseInt(box.dataset.price);
        const qty = parseInt(box.dataset.qty);
        total += price * qty;
        count++;
    });

    // Cập nhật hiển thị
    document.getElementById("cart-total-price").innerText = formatCurrency(total);
    document.getElementById("selected-count").innerText = `Tổng thanh toán (${count} sản phẩm):`;
    
    // Tự động check/uncheck nút "Chọn tất cả"
    const allBoxes = document.querySelectorAll(".cart-item-checkbox");
    const checkAllHeader = document.getElementById("check-all");
    const checkAllFooter = document.getElementById("check-all-footer");
    
    // Nếu tất cả đều được chọn → check nút tổng
    if(allBoxes.length > 0 && allBoxes.length === checkedBoxes.length) {
        if(checkAllHeader) checkAllHeader.checked = true;
        if(checkAllFooter) checkAllFooter.checked = true;
    } else {
        // Còn item chưa chọn → uncheck nút tổng
        if(checkAllHeader) checkAllHeader.checked = false;
        if(checkAllFooter) checkAllFooter.checked = false;
    }
}

// =========================================================
// 5. XÓA SẢN PHẨM & THANH TOÁN
// =========================================================

/**
 * Xóa sản phẩm khỏi giỏ hàng
 * 
 * @param {Array|null} ids - Mảng các cart ID cần xóa
 *                           Nếu null, sẽ lấy từ các checkbox đang checked
 */
function deleteSelectedItems(ids = null) {
    let idsToDelete = ids;
    
    // Nếu không truyền ids, lấy từ checkbox
    if (!idsToDelete) {
        const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
        if (checkedBoxes.length === 0) return alert("Vui lòng chọn sản phẩm để xóa!");
        idsToDelete = Array.from(checkedBoxes).map(box => box.dataset.id);
    }

    // Xác nhận trước khi xóa
    if (!confirm(`Bạn có chắc muốn xóa ${idsToDelete.length} sản phẩm này?`)) return;

    // Gọi API xóa
    fetch(`${apiUrl}/cart/delete-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartIds: idsToDelete })
    })
    .then(res => res.json())
    .then(() => initCartPage())  // Reload lại trang giỏ hàng
    .catch(err => alert("Lỗi khi xóa"));
}

/**
 * Xử lý thanh toán
 * 
 * - Lấy các sản phẩm đã chọn
 * - Lưu vào localStorage (checkout_items)
 * - Chuyển sang trang checkout.html
 */
function processCheckout() {
    const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
    if (checkedBoxes.length === 0) return alert("Vui lòng chọn sản phẩm để mua!");

    // Lấy thông tin đầy đủ của các item đã chọn
    const selectedItems = [];
    checkedBoxes.forEach(box => {
        const id = parseInt(box.dataset.id);
        const item = myCartData.find(i => i.id === id);
        if(item) selectedItems.push(item);
    });

    // Lưu vào localStorage để trang checkout đọc
    localStorage.setItem("checkout_items", JSON.stringify(selectedItems));
    
    // Chuyển sang trang thanh toán
    window.location.href = "checkout.html";
}

// =========================================================
// 6. POPUP PHÂN LOẠI (Demo)
// =========================================================

/**
 * Toggle popup thay đổi phân loại sản phẩm
 * 
 * Lưu ý: Đây chỉ là demo, chưa có chức năng thực sự thay đổi
 */
function toggleVariantPopup(index) {
    // Đóng tất cả popup khác
    document.querySelectorAll(".cart-variant-popup").forEach((el, idx) => {
        if (idx !== index) el.classList.remove("show");
    });
    
    // Toggle popup hiện tại
    const popup = document.getElementById(`popup-${index}`);
    if (popup) popup.classList.toggle("show");
    
    // Ngăn event bubble lên parent
    if(event) event.stopPropagation();
}

// Đóng popup khi click bên ngoài
window.onclick = function(event) {
    if (!event.target.closest('.cart-variant-wrap')) {
        document.querySelectorAll(".cart-variant-popup").forEach(el => el.classList.remove("show"));
    }
}

// =========================================================
// 7. HELPER FUNCTIONS
// =========================================================

/**
 * Tạo HTML cho giỏ hàng trống
 * @param {string} msg - Thông báo hiển thị
 */
function getEmptyCartHTML(msg) {
    return `
        <div style="text-align: center; padding: 50px 0;">
            <img src="https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/cart/9bdd8040b334d31946f4.png" style="width: 100px;">
            <p style="font-size: 1.4rem; color: #777; margin-top: 15px;">${msg}</p>
            <a href="index.html" class="btn btn--primary" style="margin-top: 15px;">MUA NGAY</a>
        </div>`;
}

// =========================================================
// KHỞI CHẠY
// =========================================================
// Gọi hàm khởi tạo khi file được load
initCartPage();