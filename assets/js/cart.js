// =========================================================
// FILE: assets/js/cart.js (FINAL FIX LAYOUT & CHECKBOX)
// =========================================================

const userCartLogin = safeJSONParse(localStorage.getItem("user_login"));
const userIdCart = userCartLogin ? userCartLogin.id : null;
let myCartData = [];

// 1. KHỞI TẠO
function initCartPage() {
    if (!userIdCart) {
        const wrapper = document.getElementById("cart-list-wrapper");
        if (wrapper) wrapper.innerHTML = getEmptyCartHTML("Vui lòng đăng nhập để xem giỏ hàng");
        return;
    }

    fetch(`${apiUrl}/cart/${userIdCart}`)
        .then(res => res.json())
        .then(data => {
            myCartData = data;
            renderCartPage(myCartData);
            updateFooterInfo();
        })
        .catch(err => console.error(err));
}

// 2. RENDER GIAO DIỆN 
function renderCartPage(cartItems) {
    const cartList = document.getElementById("cart-list-wrapper");
    if (!cartList) return;

    if (cartItems.length === 0) {
        cartList.innerHTML = getEmptyCartHTML("Giỏ hàng của bạn còn trống");
        const footer = document.querySelector(".cart-footer");
        if(footer) footer.style.display = "none";
        return;
    } else {
        const footer = document.querySelector(".cart-footer");
        if(footer) footer.style.display = "flex";
    }

    const htmls = cartItems.map((item, index) => {
        const itemTotal = item.price * item.quantity;
        const imgUrl = item.thumbnail || "https://via.placeholder.com/100";
        
        const variantText = (item.color || item.size) 
            ? `Phân loại: ${item.color || ''}, ${item.size || ''}` 
            : 'Phân loại: Mặc định';
        
        const hasVariant = !!(item.color || item.size);

        return `
            <div class="cart-item" id="item-${item.id}">
                <div class="cart-col-0">
                    <input type="checkbox" class="cart-item-checkbox" 
                        data-id="${item.id}" 
                        data-price="${item.price}" 
                        data-qty="${item.quantity}"
                        onchange="updateFooterInfo()">
                </div>
                
                <div class="cart-col-1">
                    <img src="${imgUrl}" class="cart-img">
                    <a href="product-detail.html?id=${item.product_id}" class="cart-name">${item.name}</a>
                </div>

                <div class="cart-col-variant">
                    ${hasVariant ? `
                        <div class="cart-variant-wrap" onclick="toggleVariantPopup(${index})">
                            <span class="cart-variant-label">${variantText}</span>
                            <i class="fas fa-caret-down cart-variant-icon"></i>
                            
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

                <div class="cart-col-2">${formatCurrency(item.price)}</div>
                
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

                <div class="cart-col-4" id="total-${item.id}">${formatCurrency(itemTotal)}</div>
                
                <div class="cart-col-5">
                    <span onclick="deleteSelectedItems([${item.id}])" class="btn-delete">Xóa</span>
                </div>
            </div>
        `;
    });
    cartList.innerHTML = htmls.join("");
}

// 3. XỬ LÝ SỐ LƯỢNG (+/-)
function updateQuantity(cartId, index, change) {
    const item = myCartData[index];
    let newQty = item.quantity + change;
    
    if (newQty < 1) return;

    fetch(`${apiUrl}/cart/update/${cartId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty })
    })
    .then(res => res.json())
    .then(() => {
        item.quantity = newQty;
        const row = document.getElementById(`item-${cartId}`);
        row.querySelector(".cart-qnt-input").value = newQty;
        
        const newTotal = newQty * item.price;
        document.getElementById(`total-${cartId}`).innerText = formatCurrency(newTotal);

        row.querySelector(".cart-item-checkbox").dataset.qty = newQty;
        updateFooterInfo();
    });
}

function onInputQuantityChange(input, cartId, index) {
    let newQty = parseInt(input.value);
    if (!newQty || newQty < 1) newQty = 1;
    const currentQty = myCartData[index].quantity;
    updateQuantity(cartId, index, newQty - currentQty);
}

// 4. CHỨC NĂNG CHỌN TẤT CẢ (ĐÃ SỬA LỖI)
function toggleCheckAll(sourceCheckbox) {
    // Lấy trạng thái checked của nút vừa bấm
    const isChecked = sourceCheckbox.checked;
    
    // Đồng bộ cả 2 nút (Trên đầu và Dưới chân)
    const headerCheck = document.getElementById("check-all");
    const footerCheck = document.getElementById("check-all-footer");
    
    if(headerCheck) headerCheck.checked = isChecked;
    if(footerCheck) footerCheck.checked = isChecked;

    // Chọn tất cả các item con
    document.querySelectorAll(".cart-item-checkbox").forEach(box => {
        box.checked = isChecked;
    });
    
    updateFooterInfo();
}

function updateFooterInfo() {
    const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
    let total = 0;
    let count = 0;

    checkedBoxes.forEach(box => {
        const price = parseInt(box.dataset.price);
        const qty = parseInt(box.dataset.qty);
        total += price * qty;
        count++;
    });

    document.getElementById("cart-total-price").innerText = formatCurrency(total);
    document.getElementById("selected-count").innerText = `Tổng thanh toán (${count} sản phẩm):`;
    
    // Tự động check/uncheck nút tổng nếu chọn lẻ tẻ
    const allBoxes = document.querySelectorAll(".cart-item-checkbox");
    const checkAllHeader = document.getElementById("check-all");
    const checkAllFooter = document.getElementById("check-all-footer");
    
    if(allBoxes.length > 0 && allBoxes.length === checkedBoxes.length) {
        if(checkAllHeader) checkAllHeader.checked = true;
        if(checkAllFooter) checkAllFooter.checked = true;
    } else {
        if(checkAllHeader) checkAllHeader.checked = false;
        if(checkAllFooter) checkAllFooter.checked = false;
    }
}

// 5. CÁC HÀM KHÁC (XÓA, THANH TOÁN...)
function deleteSelectedItems(ids = null) {
    let idsToDelete = ids;
    if (!idsToDelete) {
        const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
        if (checkedBoxes.length === 0) return alert("Vui lòng chọn sản phẩm để xóa!");
        idsToDelete = Array.from(checkedBoxes).map(box => box.dataset.id);
    }

    if (!confirm(`Bạn có chắc muốn xóa ${idsToDelete.length} sản phẩm này?`)) return;

    fetch(`${apiUrl}/cart/delete-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartIds: idsToDelete })
    })
    .then(res => res.json())
    .then(() => initCartPage())
    .catch(err => alert("Lỗi khi xóa"));
}

function processCheckout() {
    const checkedBoxes = document.querySelectorAll(".cart-item-checkbox:checked");
    if (checkedBoxes.length === 0) return alert("Vui lòng chọn sản phẩm để mua!");

    const selectedItems = [];
    checkedBoxes.forEach(box => {
        const id = parseInt(box.dataset.id);
        const item = myCartData.find(i => i.id === id);
        if(item) selectedItems.push(item);
    });

    localStorage.setItem("checkout_items", JSON.stringify(selectedItems));
    window.location.href = "checkout.html";
}

function toggleVariantPopup(index) {
    document.querySelectorAll(".cart-variant-popup").forEach((el, idx) => {
        if (idx !== index) el.classList.remove("show");
    });
    const popup = document.getElementById(`popup-${index}`);
    if (popup) popup.classList.toggle("show");
    if(event) event.stopPropagation();
}

window.onclick = function(event) {
    if (!event.target.closest('.cart-variant-wrap')) {
        document.querySelectorAll(".cart-variant-popup").forEach(el => el.classList.remove("show"));
    }
}

function getEmptyCartHTML(msg) {
    return `
        <div style="text-align: center; padding: 50px 0;">
            <img src="https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/cart/9bdd8040b334d31946f4.png" style="width: 100px;">
            <p style="font-size: 1.4rem; color: #777; margin-top: 15px;">${msg}</p>
            <a href="index.html" class="btn btn--primary" style="margin-top: 15px;">MUA NGAY</a>
        </div>`;
}

// Chạy khởi tạo
initCartPage();