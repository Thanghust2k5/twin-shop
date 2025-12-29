// =========================================================
// FILE: assets/js/product-detail.js (DATABASE REAL TIME)
// =========================================================

const userLogin = safeJSONParse(localStorage.getItem("user_login"));
const currentUserId = userLogin ? userLogin.id : null;

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

// Biến lưu trạng thái sản phẩm
let currentProduct = {};
let selectedColor = null;
let selectedSize = null;
let currentStock = 0; // Tồn kho của biến thể đang chọn

// [MỚI] BIẾN TOÀN CỤC CHO REVIEW
let currentReviewPage = 1;
let currentRatingFilter = 'all'; // 'all', 5, 4, 3...

// 1. Khởi chạy
if (!productId) {
    alert("Không tìm thấy ID sản phẩm!");
    window.location.href = "index.html";
} else {
    fetch(`${apiUrl}/products/${productId}`)
        .then(res => {
            if (!res.ok) throw new Error("Lỗi tải sản phẩm");
            return res.json();
        })
        .then(product => {
            currentProduct = product;
            renderProductDetail(product);
            
            // Xử lý biến thể (Variants)
            if (product.variants && product.variants.length > 0) {
                processVariants(product.variants);
            } else {
                // Trường hợp SP cũ chưa có variant trong DB
                document.getElementById("variant-colors").innerHTML = "<i>Mặc định</i>";
                document.getElementById("variant-sizes").innerHTML = "<i>Free Size</i>";
                currentStock = product.stock || 0; // Lấy stock chung
                document.getElementById("stock-display").innerText = currentStock;
                unlockQuantityInput(); // Cho phép mua luôn
            }
        })
        .catch(err => console.error(err));
}

function renderProductDetail(product) {
    const mainImgUrl = product.thumbnail || "https://via.placeholder.com/450";
    
    // 1. Tên & Mô tả
    document.querySelector(".product-detail__name").innerText = product.name;
    const descElement = document.getElementById("product-description-content");
    if (descElement) {
        descElement.innerText = product.description || "Chưa có mô tả cho sản phẩm này.";
    }
    // 2. Giá & Giảm giá
    const discount = product.discount_percentage || 0;
    const priceCurrent = Math.round(product.price * (1 - discount/100));
    
    document.querySelector(".product-detail__price-current").innerText = formatVND(priceCurrent);
    document.querySelector(".product-detail__price-old").innerText = formatVND(product.price);
    
    // Cập nhật thẻ GIẢM GIÁ
    const discountTag = document.querySelector(".product-detail__discount-tag");
    if (discount > 0) {
        discountTag.innerText = `GIẢM ${discount}%`;
        discountTag.style.display = "inline-block";
        document.querySelector(".product-detail__price-old").style.display = "inline-block";
    } else {
        discountTag.style.display = "none";
        document.querySelector(".product-detail__price-old").style.display = "none";
    }
    
    // 3. Đã bán & Rating (Ở phần trên cùng)
    document.querySelector(".product-detail__sold-num").innerText = formatSold(product.sold);
    document.querySelector(".product-detail__rating-score").innerText = product.rating || 5.0;
    renderStars(product.rating || 5, ".product-detail__rating-stars");
    
    // [MỚI] Cập nhật Rating to đùng ở phần Đánh giá (Bên dưới)
    const avgScoreEl = document.getElementById("avg-rating-score");
    if(avgScoreEl) avgScoreEl.innerText = product.rating || 5.0;
    
    const avgStarsEl = document.getElementById("avg-rating-stars");
    if(avgStarsEl) renderStars(product.rating || 5, "#avg-rating-stars");

    // 4. Tồn kho ban đầu
    let totalStock = product.stock;
    if (product.variants && product.variants.length > 0) {
        totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    }
    document.getElementById("stock-display").innerText = `${totalStock}`;

    // 5. Ảnh
    document.querySelector(".product-detail__img-main").src = mainImgUrl;
    renderListImages(product.images, mainImgUrl);

    // [MỚI] GỌI HÀM TẢI ĐÁNH GIÁ
    loadProductReviews(product.id);
}

// Hàm phụ để format số lượng đã bán (VD: 1200 -> 1.2k)
function formatSold(num) {
    if (!num) return "0";
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + "k";
    }
    return num;
}

// ---------------------------------------------------------
// 2. LOGIC XỬ LÝ BIẾN THỂ TỪ DATABASE
// ---------------------------------------------------------
function processVariants(variants) {
    const uniqueColors = [...new Set(variants.map(v => v.color))];
    const uniqueSizes = [...new Set(variants.map(v => v.size))];

    const colorHtml = uniqueColors.map(c => 
        `<button class="variant-btn" onclick="selectVariant('color', '${c}', this)">${c}</button>`
    ).join("");
    document.getElementById("variant-colors").innerHTML = colorHtml;

    const sizeHtml = uniqueSizes.map(s => 
        `<button class="variant-btn" onclick="selectVariant('size', '${s}', this)">${s}</button>`
    ).join("");
    document.getElementById("variant-sizes").innerHTML = sizeHtml;
}

function selectVariant(type, value, btn) {
    const container = btn.parentElement;
    container.querySelectorAll(".variant-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (type === 'color') selectedColor = value;
    if (type === 'size') selectedSize = value;

    checkStockStatus();
}

function checkStockStatus() {
    const stockDisplay = document.getElementById("stock-display");
    
    if (!selectedColor || !selectedSize) {
        stockDisplay.innerText = "...";
        disableQuantityInput();
        return;
    }

    const variant = currentProduct.variants.find(v => v.color === selectedColor && v.size === selectedSize);

    if (variant) {
        currentStock = variant.stock;
        stockDisplay.innerText = currentStock;
        
        if (currentStock > 0) {
            unlockQuantityInput();
        } else {
            stockDisplay.innerText = "Hết hàng";
            disableQuantityInput();
        }
    } else {
        currentStock = 0;
        stockDisplay.innerText = "0 (Hết hàng)";
        disableQuantityInput();
    }
}

function disableQuantityInput() {
    const box = document.getElementById("qnt-box-container");
    const input = document.getElementById("qnt-input");
    box.classList.add("disabled");
    input.disabled = true;
    input.value = 1;
}

function unlockQuantityInput() {
    const box = document.getElementById("qnt-box-container");
    const input = document.getElementById("qnt-input");
    box.classList.remove("disabled");
    input.disabled = false;
}

// ---------------------------------------------------------
// 3. LOGIC SỐ LƯỢNG & MUA HÀNG
// ---------------------------------------------------------
function changeQuantity(delta) {
    if (!currentStock && !currentProduct.stock) return;
    
    const input = document.getElementById("qnt-input");
    let newVal = parseInt(input.value) + delta;
    
    if (newVal < 1) newVal = 1;
    if (newVal > currentStock) newVal = currentStock;
    
    input.value = newVal;
}

function addToCart(isBuyNow) {
    if (!userLogin) {
        alert("Vui lòng đăng nhập để mua hàng!"); return;
    }

    if (currentProduct.variants && currentProduct.variants.length > 0) {
        if (!selectedColor || !selectedSize) {
            alert("Vui lòng chọn Phân loại hàng (Màu sắc, Size)!");
            return;
        }
        if (currentStock <= 0) {
            alert("Sản phẩm này tạm hết hàng!");
            return;
        }
    }

    const quantity = parseInt(document.getElementById("qnt-input").value);
    
    const data = {
        userId: currentUserId,
        productId: currentProduct.id,
        quantity: quantity,
        color: selectedColor || "",
        size: selectedSize || ""
    };

    fetch(`${apiUrl}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        if(isBuyNow) {
            const checkoutItem = {
                ...currentProduct,
                product_id: currentProduct.id,
                quantity: quantity,
                color: selectedColor,
                size: selectedSize
            };
            localStorage.setItem("checkout_items", JSON.stringify([checkoutItem]));
            window.location.href = "checkout.html";
        } else {
            showToast("Sản phẩm đã được thêm vào Giỏ hàng", "success", 2000);
            // Cập nhật số lượng giỏ hàng trên header sau 500ms
            setTimeout(() => {
                if (typeof updateCartCount === 'function') updateCartCount();
            }, 500);
        }
    })
    .catch(err => showToast("Lỗi hệ thống!", "error", 3000));
}

// --- CÁC HÀM TIỆN ÍCH ---
function formatVND(amount) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

// [CẬP NHẬT] Hàm render sao cho phép chọn nơi hiển thị (selector)
function renderStars(rating, selector) {
    let html = "";
    for(let i=1; i<=5; i++) {
        if(i<=rating) html += '<i class="fas fa-star" style="color: #ee4d2d;"></i>';
        else if(i-0.5<=rating) html += '<i class="fas fa-star-half-stroke" style="color: #ee4d2d;"></i>';
        else html += '<i class="fas fa-star" style="color: #d5d5d5;"></i>';
    }
    const element = document.querySelector(selector);
    if(element) element.innerHTML = html;
}

function renderListImages(images, mainImg) {
    const container = document.querySelector(".product-detail__list-img");
    let html = `<div class="product-detail__sub-img-wrap active" onclick="changeMainImage(this)"><img src="${mainImg}"></div>`;
    if(images) images.forEach(img => html += `<div class="product-detail__sub-img-wrap" onclick="changeMainImage(this)"><img src="${img}"></div>`);
    container.innerHTML = html;
}
function changeMainImage(el) {
    document.querySelector(".product-detail__img-main").src = el.querySelector("img").src;
    document.querySelectorAll(".product-detail__sub-img-wrap").forEach(e => e.classList.remove("active"));
    el.classList.add("active");
}

function scrollToReviews() {
    const reviewSection = document.getElementById("product-reviews-section");
    if (reviewSection) {
        const elementTop = reviewSection.getBoundingClientRect().top + window.scrollY;
        const headerOffset = 130; 
        const offsetPosition = elementTop - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }
}

// =========================================================
// [MỚI] PHẦN LOGIC ĐÁNH GIÁ SẢN PHẨM
// =========================================================

// 1. HÀM TẢI ĐÁNH GIÁ
function loadProductReviews(productId, page = 1, rating = 'all') {
    currentReviewPage = page;
    currentRatingFilter = rating;

    // Gọi API lấy đánh giá
    fetch(`${apiUrl}/products/${productId}/reviews?page=${page}&limit=5&rating=${rating}`)
        .then(res => res.json())
        .then(data => {
            renderReviewsList(data.data);
            renderReviewFilters(data.stats, rating);
            renderReviewPagination(data.pagination);
        })
        .catch(err => console.error("Lỗi tải review:", err));
}

// 2. HÀM HIỂN THỊ DANH SÁCH REVIEW
function renderReviewsList(reviews) {
    const container = document.getElementById("review-list-container");
    container.innerHTML = "";

    if (reviews.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 30px; font-size:1.4rem; color:#777;">Chưa có đánh giá nào cho mức sao này.</div>`;
        return;
    }

    reviews.forEach(review => {
        // Tạo số sao cho từng review
        let starsHtml = "";
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="fas fa-star" style="color: ${i <= review.rating ? '#ee4d2d' : '#ddd'}"></i>`;
        }
        
        const date = new Date(review.created_at).toLocaleString('vi-VN');
        const avatar = review.avatar || "https://down-bs.img.susercontent.com/vn-11134233-7r98o-lsw4m297c11f7c.webp";

        const html = `
            <div class="review-item">
                <div class="review-avatar">
                    <img src="${avatar}" alt="ava">
                </div>
                <div class="review-main">
                    <a href="#" class="review-author-name">${review.full_name}</a>
                    <div class="review-star-date">
                        <span class="review-stars">${starsHtml}</span>
                        <span class="review-time">${date}</span>
                    </div>
                    <div class="review-content">
                        ${review.comment || ""}
                    </div>
                    <div class="review-response">
                        <span class="review-response__label">Phản Hồi Của Người Bán</span>
                        <div class="review-response__content">
                            Shop xin chân thành cảm ơn bạn đã tin tưởng mua hàng. Chúc bạn luôn vui vẻ và hạnh phúc!
                        </div>
                    </div>
                    <div class="review-actions">
                        <div class="review-action-btn"><i class="fas fa-thumbs-up" style="margin-right: 5px;"></i> Hữu ích?</div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// 3. HÀM TẠO BỘ LỌC SAO
function renderReviewFilters(stats, activeRating) {
    const container = document.getElementById("rating-filters");
    
    // Nút Tất cả
    let html = `
        <div class="rating-filter-btn ${activeRating === 'all' ? 'active' : ''}" 
             onclick="loadProductReviews(${currentProduct.id}, 1, 'all')">
             Tất Cả (${stats.all})
        </div>
    `;

    // Các nút 5 sao -> 1 sao
    for (let i = 5; i >= 1; i--) {
        html += `
            <div class="rating-filter-btn ${activeRating == i ? 'active' : ''}" 
                 onclick="loadProductReviews(${currentProduct.id}, 1, ${i})">
                 ${i} Sao (${stats[i]})
            </div>
        `;
    }
    container.innerHTML = html;
}

// 4. HÀM TẠO PHÂN TRANG REVIEW
function renderReviewPagination(pagination) {
    const container = document.getElementById("review-pagination");
    container.innerHTML = "";

    if (pagination.totalPages <= 1) return;

    let html = `<ul class="pagination">`;

    // Nút Prev
    if (pagination.page > 1) {
        html += `
            <li class="pagination-item">
                <a href="javascript:void(0)" class="pagination-item__link" 
                   onclick="loadProductReviews(${currentProduct.id}, ${pagination.page - 1}, '${currentRatingFilter}')">
                    <i class="fas fa-angle-left"></i>
                </a>
            </li>
        `;
    }

    // Các số trang
    for (let i = 1; i <= pagination.totalPages; i++) {
        const activeClass = i === pagination.page ? "pagination-item--active" : "";
        html += `
            <li class="pagination-item ${activeClass}">
                <a href="javascript:void(0)" class="pagination-item__link" 
                   onclick="loadProductReviews(${currentProduct.id}, ${i}, '${currentRatingFilter}')">
                    ${i}
                </a>
            </li>
        `;
    }

    // Nút Next
    if (pagination.page < pagination.totalPages) {
        html += `
            <li class="pagination-item">
                <a href="javascript:void(0)" class="pagination-item__link" 
                   onclick="loadProductReviews(${currentProduct.id}, ${pagination.page + 1}, '${currentRatingFilter}')">
                    <i class="fas fa-angle-right"></i>
                </a>
            </li>
        `;
    }

    html += `</ul>`;
    container.innerHTML = html;
}