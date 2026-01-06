// =========================================================
// FILE: assets/js/product-detail.js (DATABASE REAL TIME)
// =========================================================
// 
// MỤC ĐÍCH: Quản lý trang chi tiết sản phẩm
// File này xử lý toàn bộ logic cho trang xem chi tiết 1 sản phẩm:
//   - Hiển thị thông tin sản phẩm (tên, giá, mô tả, hình ảnh)
//   - Xử lý biến thể (variants): màu sắc, size -> cập nhật tồn kho
//   - Thêm vào giỏ hàng hoặc Mua ngay
//   - Hiển thị đánh giá (reviews) với phân trang và lọc theo số sao
//
// CẤU TRÚC FILE:
//   1. Khởi chạy (Init) - Kiểm tra ID sản phẩm, gọi API lấy dữ liệu
//   2. Hiển thị chi tiết sản phẩm (renderProductDetail)
//   3. Xử lý biến thể (processVariants, selectVariant, checkStockStatus)
//   4. Logic số lượng và mua hàng (changeQuantity, addToCart)
//   5. Các hàm tiện ích (formatVND, renderStars, renderListImages)
//   6. Hệ thống đánh giá (loadProductReviews, renderReviewsList, filters, pagination)
// =========================================================

// =========================================================
// PHẦN 1: KHỞI TẠO BIẾN TOÀN CỤC
// =========================================================
// Mục đích: Khai báo tất cả biến cần dùng trong toàn bộ file
// Đây là các biến "state" lưu trữ trạng thái hiện tại

// ---- THÔNG TIN NGƯỜI DÙNG ----
// safeJSONParse: Hàm parse an toàn từ validation.js (tránh lỗi JSON)
// Lấy thông tin user đã đăng nhập từ localStorage
const userLogin = safeJSONParse(localStorage.getItem("user_login"));

// Lấy ID của user (nếu chưa đăng nhập sẽ là null)
// ID này dùng để gửi lên server khi thêm vào giỏ hàng
const currentUserId = userLogin ? userLogin.id : null;

// ---- LẤY ID SẢN PHẨM TỪ URL ----
// URL có dạng: product-detail.html?id=123
// URLSearchParams giúp parse phần ?id=123 thành object
// Ví dụ: urlParams.get("id") -> "123"
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

// ---- BIẾN LƯU TRẠNG THÁI SẢN PHẨM ----
// currentProduct: Object chứa toàn bộ thông tin sản phẩm từ API
let currentProduct = {};

// selectedColor: Màu sắc user đang chọn (VD: "Đỏ", "Xanh")
let selectedColor = null;

// selectedSize: Size user đang chọn (VD: "S", "M", "L", "XL")
let selectedSize = null;

// currentStock: Số lượng tồn kho của biến thể đang chọn
// VD: Áo Đỏ Size M còn 15 cái -> currentStock = 15
let currentStock = 0;

// ---- BIẾN CHO PHẦN ĐÁNH GIÁ (REVIEWS) ----
// currentReviewPage: Trang hiện tại của danh sách review (phân trang)
let currentReviewPage = 1;

// currentRatingFilter: Bộ lọc đang chọn
// 'all' = tất cả, 5 = 5 sao, 4 = 4 sao, ...
let currentRatingFilter = 'all';

// =========================================================
// PHẦN 2: KHỞI CHẠY - TẢI DỮ LIỆU SẢN PHẨM
// =========================================================
// Mục đích: Kiểm tra ID sản phẩm và gọi API lấy thông tin chi tiết
// Đây là đoạn code chạy ngay khi file được load

// ---- KIỂM TRA ID SẢN PHẨM ----
// Nếu URL không có ?id=xxx -> báo lỗi và quay về trang chủ
if (!productId) {
    alert("Không tìm thấy ID sản phẩm!");
    window.location.href = "index.html";
} else {
    // ---- GỌI API LẤY CHI TIẾT SẢN PHẨM ----
    // Gửi request GET đến: /api/products/{id}
    // VD: /api/products/123
    fetch(`${apiUrl}/products/${productId}`)
        .then(res => {
            // Kiểm tra response có OK không (status 200-299)
            if (!res.ok) throw new Error("Lỗi tải sản phẩm");
            // Chuyển response thành JSON object
            return res.json();
        })
        .then(product => {
            // ---- XỬ LÝ DỮ LIỆU SẢN PHẨM ----
            // Lưu vào biến toàn cục để dùng ở các hàm khác
            currentProduct = product;
            
            // Gọi hàm hiển thị thông tin sản phẩm lên giao diện
            renderProductDetail(product);
            
            // ---- XỬ LÝ BIẾN THỂ (VARIANTS) ----
            // Variants = các phiên bản của sản phẩm (VD: Áo Đỏ Size M, Áo Xanh Size L)
            // Mỗi variant có: color, size, stock (tồn kho riêng)
            if (product.variants && product.variants.length > 0) {
                // Sản phẩm có variants -> gọi hàm xử lý
                processVariants(product.variants);
            } else {
                // ---- SẢN PHẨM KHÔNG CÓ VARIANT ----
                // Trường hợp sản phẩm cũ chưa có variant trong DB
                // Hiển thị thông báo mặc định
                document.getElementById("variant-colors").innerHTML = "<i>Mặc định</i>";
                document.getElementById("variant-sizes").innerHTML = "<i>Free Size</i>";
                
                // Lấy stock chung của sản phẩm (không theo variant)
                currentStock = product.stock || 0;
                document.getElementById("stock-display").innerText = currentStock;
                
                // Cho phép mua luôn (không cần chọn variant)
                unlockQuantityInput();
            }
        })
        .catch(err => console.error(err));
}

// =========================================================
// PHẦN 3: HIỂN THỊ CHI TIẾT SẢN PHẨM
// =========================================================
// Mục đích: Render thông tin sản phẩm lên giao diện HTML
// Hàm này nhận object product và cập nhật các element trên trang

function renderProductDetail(product) {
    // ---- LẤY ẢNH CHÍNH ----
    // Nếu không có thumbnail -> dùng ảnh placeholder mặc định
    const mainImgUrl = product.thumbnail || "https://via.placeholder.com/450";
    
    // ---- 1. TÊN & MÔ TẢ SẢN PHẨM ----
    // Cập nhật tên sản phẩm vào element có class tương ứng
    document.querySelector(".product-detail__name").innerText = product.name;
    
    // Cập nhật mô tả sản phẩm
    const descElement = document.getElementById("product-description-content");
    if (descElement) {
        descElement.innerText = product.description || "Chưa có mô tả cho sản phẩm này.";
    }
    
    // ---- 2. GIÁ & GIẢM GIÁ ----
    // discount_percentage: Phần trăm giảm giá (VD: 20 = giảm 20%)
    const discount = product.discount_percentage || 0;
    
    // Tính giá sau khi giảm
    // Công thức: giá_sau = giá_gốc × (1 - phần_trăm_giảm/100)
    // VD: 100.000đ × (1 - 20/100) = 100.000 × 0.8 = 80.000đ
    const priceCurrent = Math.round(product.price * (1 - discount/100));
    
    // Hiển thị giá hiện tại (sau giảm) và giá gốc (gạch ngang)
    document.querySelector(".product-detail__price-current").innerText = formatVND(priceCurrent);
    document.querySelector(".product-detail__price-old").innerText = formatVND(product.price);
    
    // ---- CẬP NHẬT THẺ GIẢM GIÁ ----
    // Hiển thị badge "GIẢM XX%" nếu có giảm giá
    const discountTag = document.querySelector(".product-detail__discount-tag");
    if (discount > 0) {
        // Có giảm giá -> hiển thị tag và giá cũ
        discountTag.innerText = `GIẢM ${discount}%`;
        discountTag.style.display = "inline-block";
        document.querySelector(".product-detail__price-old").style.display = "inline-block";
    } else {
        // Không giảm giá -> ẩn tag và giá cũ
        discountTag.style.display = "none";
        document.querySelector(".product-detail__price-old").style.display = "none";
    }
    
    // ---- 3. SỐ LƯỢNG ĐÃ BÁN & ĐÁNH GIÁ ----
    // formatSold: Format số đẹp (1200 -> 1.2k)
    document.querySelector(".product-detail__sold-num").innerText = formatSold(product.sold);
    
    // Hiển thị điểm đánh giá (VD: 4.8)
    document.querySelector(".product-detail__rating-score").innerText = product.rating || 5.0;
    
    // Render số sao (★★★★☆) vào phần header sản phẩm
    renderStars(product.rating || 5, ".product-detail__rating-stars");
    
    // ---- CẬP NHẬT RATING Ở PHẦN ĐÁNH GIÁ (PHÍA DƯỚI TRANG) ----
    // Có 2 vị trí hiển thị rating: 1 ở header sản phẩm, 1 ở section đánh giá
    const avgScoreEl = document.getElementById("avg-rating-score");
    if(avgScoreEl) avgScoreEl.innerText = product.rating || 5.0;
    
    const avgStarsEl = document.getElementById("avg-rating-stars");
    if(avgStarsEl) renderStars(product.rating || 5, "#avg-rating-stars");

    // ---- 4. TỒN KHO BAN ĐẦU ----
    // Tính tổng tồn kho để hiển thị ban đầu
    let totalStock = product.stock;
    
    // Nếu có variants -> tổng = cộng stock của tất cả variants
    if (product.variants && product.variants.length > 0) {
        // reduce: Duyệt qua mảng và tính tổng
        // sum: Giá trị tích lũy, v: phần tử hiện tại
        totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    }
    document.getElementById("stock-display").innerText = `${totalStock}`;

    // ---- 5. HIỂN THỊ ẢNH SẢN PHẨM ----
    // Cập nhật ảnh chính
    document.querySelector(".product-detail__img-main").src = mainImgUrl;
    
    // Render danh sách ảnh nhỏ (thumbnail gallery)
    renderListImages(product.images, mainImgUrl);

    // ---- 6. TẢI ĐÁNH GIÁ SẢN PHẨM ----
    // Gọi hàm load reviews với trang 1 (mặc định)
    loadProductReviews(product.id);
}

// ---- HÀM PHỤ: FORMAT SỐ LƯỢNG ĐÃ BÁN ----
// Mục đích: Chuyển số lớn thành dạng ngắn gọn
// VD: 1200 -> "1.2k", 500 -> "500"
function formatSold(num) {
    // Nếu không có giá trị -> trả về "0"
    if (!num) return "0";
    
    // Nếu >= 1000 -> chia cho 1000 và thêm "k"
    // toFixed(1): Làm tròn 1 số sau dấu phẩy
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + "k";
    }
    
    // Số < 1000 -> giữ nguyên
    return num;
}

// =========================================================
// PHẦN 4: XỬ LÝ BIẾN THỂ (VARIANTS)
// =========================================================
// Mục đích: Xử lý logic chọn màu sắc & size của sản phẩm
// 
// VARIANTS LÀ GÌ?
// - 1 sản phẩm có thể có nhiều biến thể
// - VD: Áo thun có các biến thể:
//   + Đỏ - Size S (tồn 10)
//   + Đỏ - Size M (tồn 5)
//   + Xanh - Size S (tồn 8)
//   + Xanh - Size M (tồn 0 - hết hàng)
// - Khi user chọn Màu + Size -> hiển thị tồn kho tương ứng

// ---- HÀM XỬ LÝ & HIỂN THỊ CÁC NÚT VARIANT ----
// Mục đích: Tạo các button chọn màu sắc & size từ dữ liệu variants
function processVariants(variants) {
    // ---- LỌC RA CÁC MÀU UNIQUE (KHÔNG TRÙNG) ----
    // variants.map(v => v.color): Lấy mảng tất cả màu ["Đỏ", "Đỏ", "Xanh", "Xanh"]
    // new Set(...): Loại bỏ trùng lặp -> Set {"Đỏ", "Xanh"}
    // [...Set]: Chuyển Set về mảng ["Đỏ", "Xanh"]
    const uniqueColors = [...new Set(variants.map(v => v.color))];
    
    // Tương tự cho Size
    const uniqueSizes = [...new Set(variants.map(v => v.size))];

    // ---- TẠO HTML CHO CÁC NÚT MÀU SẮC ----
    // map: Chuyển mỗi màu thành 1 button HTML
    // join(""): Nối tất cả button thành 1 chuỗi
    const colorHtml = uniqueColors.map(c => 
        `<button class="variant-btn" onclick="selectVariant('color', '${c}', this)">${c}</button>`
    ).join("");
    document.getElementById("variant-colors").innerHTML = colorHtml;

    // ---- TẠO HTML CHO CÁC NÚT SIZE ----
    const sizeHtml = uniqueSizes.map(s => 
        `<button class="variant-btn" onclick="selectVariant('size', '${s}', this)">${s}</button>`
    ).join("");
    document.getElementById("variant-sizes").innerHTML = sizeHtml;
}

// ---- HÀM XỬ LÝ KHI USER CLICK CHỌN VARIANT ----
// Params:
//   - type: Loại variant ('color' hoặc 'size')
//   - value: Giá trị chọn (VD: "Đỏ", "M")
//   - btn: Element button được click
function selectVariant(type, value, btn) {
    // ---- CẬP NHẬT TRẠNG THÁI BUTTON ----
    // Lấy container chứa button (variant-colors hoặc variant-sizes)
    const container = btn.parentElement;
    
    // Bỏ class "active" khỏi tất cả button trong container
    container.querySelectorAll(".variant-btn").forEach(b => b.classList.remove("active"));
    
    // Thêm class "active" vào button được click
    btn.classList.add("active");

    // ---- LƯU GIÁ TRỊ ĐÃ CHỌN VÀO BIẾN TOÀN CỤC ----
    if (type === 'color') selectedColor = value;
    if (type === 'size') selectedSize = value;

    // ---- KIỂM TRA & CẬP NHẬT TỒN KHO ----
    // Sau khi chọn variant, cần check xem tồn kho còn bao nhiêu
    checkStockStatus();
}

// ---- HÀM KIỂM TRA TỒN KHO CỦA VARIANT ĐÃ CHỌN ----
// Mục đích: Tìm variant phù hợp và cập nhật hiển thị tồn kho
function checkStockStatus() {
    const stockDisplay = document.getElementById("stock-display");
    
    // ---- CHƯA CHỌN ĐỦ MÀU + SIZE ----
    // Phải chọn cả 2 mới biết tồn kho cụ thể
    if (!selectedColor || !selectedSize) {
        stockDisplay.innerText = "..."; // Hiển thị chờ
        disableQuantityInput();         // Khóa ô nhập số lượng
        return;
    }

    // ---- TÌM VARIANT PHÙ HỢP TRONG DANH SÁCH ----
    // find: Tìm phần tử đầu tiên thỏa điều kiện
    // Điều kiện: color và size khớp với đã chọn
    const variant = currentProduct.variants.find(
        v => v.color === selectedColor && v.size === selectedSize
    );

    if (variant) {
        // ---- TÌM THẤY VARIANT ----
        currentStock = variant.stock;
        stockDisplay.innerText = currentStock;
        
        if (currentStock > 0) {
            // Còn hàng -> mở khóa ô nhập số lượng
            unlockQuantityInput();
        } else {
            // Hết hàng -> hiển thị thông báo và khóa
            stockDisplay.innerText = "Hết hàng";
            disableQuantityInput();
        }
    } else {
        // ---- KHÔNG TÌM THẤY VARIANT ----
        // Trường hợp hiếm: combo màu + size không tồn tại trong DB
        currentStock = 0;
        stockDisplay.innerText = "0 (Hết hàng)";
        disableQuantityInput();
    }
}

// ---- HÀM KHÓA Ô NHẬP SỐ LƯỢNG ----
// Gọi khi: Chưa chọn đủ variant hoặc hết hàng
function disableQuantityInput() {
    const box = document.getElementById("qnt-box-container");
    const input = document.getElementById("qnt-input");
    
    // Thêm class "disabled" để CSS hiển thị mờ
    box.classList.add("disabled");
    
    // Vô hiệu hóa input
    input.disabled = true;
    input.value = 1; // Reset về 1
}

// ---- HÀM MỞ KHÓA Ô NHẬP SỐ LƯỢNG ----
// Gọi khi: Đã chọn đủ variant và còn hàng
function unlockQuantityInput() {
    const box = document.getElementById("qnt-box-container");
    const input = document.getElementById("qnt-input");
    
    // Bỏ class "disabled"
    box.classList.remove("disabled");
    
    // Cho phép nhập lại
    input.disabled = false;
}

// =========================================================
// PHẦN 5: LOGIC SỐ LƯỢNG & MUA HÀNG
// =========================================================
// Mục đích: Xử lý việc thay đổi số lượng và thêm vào giỏ hàng

// ---- HÀM THAY ĐỔI SỐ LƯỢNG ----
// Gọi khi: User click nút + hoặc - để thay đổi số lượng
// Params:
//   - delta: Số thay đổi (+1 khi click +, -1 khi click -)
function changeQuantity(delta) {
    // Kiểm tra có tồn kho không (variant hoặc stock chung)
    if (!currentStock && !currentProduct.stock) return;
    
    // Lấy ô input số lượng
    const input = document.getElementById("qnt-input");
    
    // Tính giá trị mới = giá trị hiện tại + delta
    let newVal = parseInt(input.value) + delta;
    
    // ---- GIỚI HẠN SỐ LƯỢNG ----
    // Không cho nhỏ hơn 1 (phải mua ít nhất 1)
    if (newVal < 1) newVal = 1;
    
    // Không cho lớn hơn tồn kho
    if (newVal > currentStock) newVal = currentStock;
    
    // Cập nhật giá trị vào input
    input.value = newVal;
}

// ---- HÀM THÊM VÀO GIỎ HÀNG / MUA NGAY ----
// Mục đích: Xử lý khi user click "Thêm vào giỏ hàng" hoặc "Mua ngay"
// Params:
//   - isBuyNow: true = Mua ngay (chuyển thẳng checkout), false = Thêm vào giỏ
function addToCart(isBuyNow) {
    // ---- KIỂM TRA ĐĂNG NHẬP ----
    // Phải đăng nhập mới được mua hàng
    if (!userLogin) {
        alert("Vui lòng đăng nhập để mua hàng!"); 
        return;
    }

    // ---- KIỂM TRA ĐÃ CHỌN VARIANT CHƯA ----
    // Chỉ kiểm tra nếu sản phẩm có variants
    if (currentProduct.variants && currentProduct.variants.length > 0) {
        // Chưa chọn màu hoặc size -> báo lỗi
        if (!selectedColor || !selectedSize) {
            alert("Vui lòng chọn Phân loại hàng (Màu sắc, Size)!");
            return;
        }
        
        // Đã chọn nhưng hết hàng -> báo lỗi
        if (currentStock <= 0) {
            alert("Sản phẩm này tạm hết hàng!");
            return;
        }
    }

    // ---- LẤY SỐ LƯỢNG TỪ INPUT ----
    const quantity = parseInt(document.getElementById("qnt-input").value);
    
    // ---- CHUẨN BỊ DỮ LIỆU GỬI LÊN SERVER ----
    const data = {
        userId: currentUserId,          // ID người dùng
        productId: currentProduct.id,   // ID sản phẩm
        quantity: quantity,             // Số lượng muốn mua
        color: selectedColor || "",     // Màu đã chọn (hoặc rỗng)
        size: selectedSize || ""        // Size đã chọn (hoặc rỗng)
    };

    // ---- GỌI API THÊM VÀO GIỎ HÀNG ----
    // POST /api/cart với body là data
    fetch(`${apiUrl}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)  // Chuyển object thành JSON string
    })
    .then(res => res.json())
    .then(result => {
        // ---- XỬ LÝ SAU KHI THÊM THÀNH CÔNG ----
        if(isBuyNow) {
            // ---- MUA NGAY ----
            // Tạo object chứa thông tin sản phẩm để checkout
            const checkoutItem = {
                ...currentProduct,              // Spread: copy tất cả thuộc tính của product
                product_id: currentProduct.id,  // Đảm bảo có product_id
                quantity: quantity,             // Số lượng mua
                color: selectedColor,           // Màu đã chọn
                size: selectedSize              // Size đã chọn
            };
            
            // Lưu vào localStorage để trang checkout đọc
            localStorage.setItem("checkout_items", JSON.stringify([checkoutItem]));
            
            // Chuyển hướng sang trang checkout
            window.location.href = "checkout.html";
        } else {
            // ---- THÊM VÀO GIỎ HÀNG ----
            // Hiển thị thông báo thành công
            showToast("Sản phẩm đã được thêm vào Giỏ hàng", "success", 2000);
            
            // Cập nhật số lượng giỏ hàng trên header sau 500ms
            // Delay để đợi server xử lý xong
            setTimeout(() => {
                // Kiểm tra hàm updateCartCount có tồn tại không (từ main.js)
                if (typeof updateCartCount === 'function') updateCartCount();
            }, 500);
        }
    })
    .catch(err => showToast("Lỗi hệ thống!", "error", 3000));
}

// =========================================================
// PHẦN 6: CÁC HÀM TIỆN ÍCH (UTILITY FUNCTIONS)
// =========================================================
// Mục đích: Các hàm nhỏ hỗ trợ định dạng và hiển thị

// ---- HÀM FORMAT TIỀN VIỆT NAM ----
// Mục đích: Chuyển số thành định dạng tiền tệ VNĐ
// VD: 100000 -> "100.000 ₫"
function formatVND(amount) {
    // Intl.NumberFormat: API chuẩn để format số theo quốc gia
    // 'vi-VN': Locale Việt Nam (dấu chấm phân cách hàng nghìn)
    // style: 'currency': Format dạng tiền tệ
    // currency: 'VND': Đơn vị tiền Việt Nam
    return new Intl.NumberFormat("vi-VN", { 
        style: "currency", 
        currency: "VND" 
    }).format(amount);
}

// ---- HÀM RENDER SỐ SAO ĐÁNH GIÁ ----
// Mục đích: Tạo HTML hiển thị số sao (★★★★☆)
// Params:
//   - rating: Điểm đánh giá (0-5, có thể là số thập phân VD: 4.5)
//   - selector: CSS selector của element để hiển thị (VD: ".product-detail__rating-stars")
function renderStars(rating, selector) {
    let html = "";
    
    // Duyệt từ 1 đến 5 để render từng sao
    for(let i = 1; i <= 5; i++) {
        if(i <= rating) {
            // Sao đầy (rating >= vị trí sao) - màu cam
            html += '<i class="fas fa-star" style="color: #ee4d2d;"></i>';
        }
        else if(i - 0.5 <= rating) {
            // Sao nửa (rating >= vị trí - 0.5) - nửa cam
            // VD: rating = 4.5, i = 5 -> 5 - 0.5 = 4.5 <= 4.5 -> sao nửa
            html += '<i class="fas fa-star-half-stroke" style="color: #ee4d2d;"></i>';
        }
        else {
            // Sao rỗng - màu xám
            html += '<i class="fas fa-star" style="color: #d5d5d5;"></i>';
        }
    }
    
    // Tìm element và gán HTML
    const element = document.querySelector(selector);
    if(element) element.innerHTML = html;
}

// ---- HÀM RENDER DANH SÁCH ẢNH NHỎ (GALLERY) ----
// Mục đích: Tạo các thumbnail ảnh cho user click xem
// Params:
//   - images: Mảng các URL ảnh phụ
//   - mainImg: URL ảnh chính (thumbnail)
function renderListImages(images, mainImg) {
    // Lấy container chứa danh sách ảnh nhỏ
    const container = document.querySelector(".product-detail__list-img");
    
    // ---- TẠO ẢNH ĐẦU TIÊN (ẢNH CHÍNH) ----
    // class="active": Đánh dấu đang được chọn
    // onclick="changeMainImage(this)": Khi click sẽ đổi ảnh lớn
    let html = `<div class="product-detail__sub-img-wrap active" onclick="changeMainImage(this)">
        <img src="${mainImg}">
    </div>`;
    
    // ---- TẠO CÁC ẢNH PHỤ ----
    if(images) {
        images.forEach(img => {
            html += `<div class="product-detail__sub-img-wrap" onclick="changeMainImage(this)">
                <img src="${img}">
            </div>`;
        });
    }
    
    // Gán HTML vào container
    container.innerHTML = html;
}

// ---- HÀM ĐỔI ẢNH CHÍNH KHI CLICK ẢNH NHỎ ----
// Gọi khi: User click vào 1 ảnh trong gallery
// Params:
//   - el: Element ảnh nhỏ được click
function changeMainImage(el) {
    // ---- CẬP NHẬT ẢNH CHÍNH ----
    // Lấy src từ ảnh nhỏ và gán vào ảnh lớn
    document.querySelector(".product-detail__img-main").src = el.querySelector("img").src;
    
    // ---- CẬP NHẬT TRẠNG THÁI ACTIVE ----
    // Bỏ class "active" khỏi tất cả ảnh nhỏ
    document.querySelectorAll(".product-detail__sub-img-wrap").forEach(e => e.classList.remove("active"));
    
    // Thêm class "active" vào ảnh được click
    el.classList.add("active");
}

// ---- HÀM CUỘN ĐẾN PHẦN ĐÁNH GIÁ ----
// Gọi khi: User click vào số sao hoặc link xem đánh giá
// Mục đích: Cuộn trang xuống phần reviews một cách mượt mà
function scrollToReviews() {
    // Lấy element section đánh giá
    const reviewSection = document.getElementById("product-reviews-section");
    
    if (reviewSection) {
        // ---- TÍNH TOÁN VỊ TRÍ CUỘN ----
        // getBoundingClientRect().top: Khoảng cách từ element đến đỉnh viewport
        // window.scrollY: Vị trí cuộn hiện tại của trang
        const elementTop = reviewSection.getBoundingClientRect().top + window.scrollY;
        
        // headerOffset: Khoảng cách bù cho header cố định (130px)
        // Để element không bị che bởi header
        const headerOffset = 130; 
        
        // Vị trí cuộn cuối cùng = vị trí element - offset header
        const offsetPosition = elementTop - headerOffset;

        // ---- THỰC HIỆN CUỘN MỀM ----
        // behavior: "smooth" tạo hiệu ứng cuộn mượt mà
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }
}

// =========================================================
// PHẦN 7: HỆ THỐNG ĐÁNH GIÁ SẢN PHẨM (REVIEWS)
// =========================================================
// Mục đích: Quản lý việc hiển thị, lọc và phân trang các đánh giá
//
// TÍNH NĂNG:
//   - Tải danh sách đánh giá từ API
//   - Lọc theo số sao (5 sao, 4 sao, ...)
//   - Phân trang (5 đánh giá/trang)
//   - Hiển thị thống kê số lượng đánh giá theo từng mức sao

// ---- HÀM TẢI ĐÁNH GIÁ TỪ SERVER ----
// Mục đích: Gọi API lấy danh sách đánh giá của sản phẩm
// Params:
//   - productId: ID sản phẩm cần lấy đánh giá
//   - page: Trang hiện tại (mặc định = 1)
//   - rating: Bộ lọc sao ('all', 5, 4, 3, 2, 1)
function loadProductReviews(productId, page = 1, rating = 'all') {
    // ---- LƯU TRẠNG THÁI HIỆN TẠI ----
    // Dùng cho các hàm khác biết đang ở trang/filter nào
    currentReviewPage = page;
    currentRatingFilter = rating;

    // ---- GỌI API LẤY ĐÁNH GIÁ ----
    // GET /api/products/{id}/reviews?page=1&limit=5&rating=all
    // - page: Số trang
    // - limit: Số review/trang (5)
    // - rating: Lọc theo số sao
    fetch(`${apiUrl}/products/${productId}/reviews?page=${page}&limit=5&rating=${rating}`)
        .then(res => res.json())
        .then(data => {
            // ---- RENDER CÁC THÀNH PHẦN ----
            // data.data: Mảng các review
            // data.stats: Thống kê số lượng theo sao {all: 50, 5: 30, 4: 10, ...}
            // data.pagination: Thông tin phân trang {page: 1, totalPages: 5, ...}
            
            renderReviewsList(data.data);           // Render danh sách review
            renderReviewFilters(data.stats, rating); // Render các nút filter
            renderReviewPagination(data.pagination); // Render phân trang
        })
        .catch(err => console.error("Lỗi tải review:", err));
}

// ---- HÀM HIỂN THỊ DANH SÁCH ĐÁNH GIÁ ----
// Mục đích: Render từng review thành HTML và hiển thị
// Params:
//   - reviews: Mảng các object review từ API
function renderReviewsList(reviews) {
    // Lấy container để hiển thị reviews
    const container = document.getElementById("review-list-container");
    container.innerHTML = "";

    // ---- TRƯỜNG HỢP KHÔNG CÓ REVIEW ----
    if (reviews.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 30px; font-size:1.4rem; color:#777;">
                Chưa có đánh giá nào cho mức sao này.
            </div>`;
        return;
    }

    // ---- DUYỆT QUA TỪNG REVIEW VÀ RENDER ----
    reviews.forEach(review => {
        // ---- TẠO HTML CHO SỐ SAO ----
        // Tạo 5 icon sao, sao nào <= rating thì tô màu cam
        let starsHtml = "";
        for (let i = 1; i <= 5; i++) {
            // Nếu i <= rating -> sao cam, ngược lại -> sao xám
            starsHtml += `<i class="fas fa-star" style="color: ${i <= review.rating ? '#ee4d2d' : '#ddd'}"></i>`;
        }
        
        // ---- FORMAT NGÀY GIỜ ----
        // Chuyển timestamp từ DB thành format VN (VD: "15:30:00 25/12/2024")
        const date = new Date(review.created_at).toLocaleString('vi-VN');
        
        // ---- XỬ LÝ AVATAR ----
        // Nếu user không có avatar -> dùng ảnh mặc định
        const avatar = review.avatar || "https://down-bs.img.susercontent.com/vn-11134233-7r98o-lsw4m297c11f7c.webp";

        // ---- TẠO HTML CHO 1 REVIEW ----
        const html = `
            <div class="review-item">
                <!-- Avatar người đánh giá -->
                <div class="review-avatar">
                    <img src="${avatar}" alt="ava">
                </div>
                
                <!-- Nội dung chính của review -->
                <div class="review-main">
                    <!-- Tên người đánh giá -->
                    <a href="#" class="review-author-name">${review.full_name}</a>
                    
                    <!-- Số sao và thời gian -->
                    <div class="review-star-date">
                        <span class="review-stars">${starsHtml}</span>
                        <span class="review-time">${date}</span>
                    </div>
                    
                    <!-- Nội dung bình luận -->
                    <div class="review-content">
                        ${review.comment || ""}
                    </div>
                    
                    <!-- Phản hồi từ người bán -->
                    <div class="review-response">
                        <span class="review-response__label">Phản Hồi Của Người Bán</span>
                        <div class="review-response__content">
                            Shop xin chân thành cảm ơn bạn đã tin tưởng mua hàng. Chúc bạn luôn vui vẻ và hạnh phúc!
                        </div>
                    </div>
                    
                    <!-- Nút actions (Hữu ích, Báo cáo, ...) -->
                    <div class="review-actions">
                        <div class="review-action-btn">
                            <i class="fas fa-thumbs-up" style="margin-right: 5px;"></i> Hữu ích?
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Thêm HTML vào container
        container.innerHTML += html;
    });
}

// ---- HÀM TẠO CÁC NÚT LỌC THEO SAO ----
// Mục đích: Render các button filter (Tất cả, 5 Sao, 4 Sao, ...)
// Params:
//   - stats: Object thống kê {all: 50, 5: 30, 4: 10, 3: 5, 2: 3, 1: 2}
//   - activeRating: Filter đang được chọn ('all' hoặc 1-5)
function renderReviewFilters(stats, activeRating) {
    const container = document.getElementById("rating-filters");
    
    // ---- TẠO NÚT "TẤT CẢ" ----
    // Thêm class "active" nếu đang filter 'all'
    let html = `
        <div class="rating-filter-btn ${activeRating === 'all' ? 'active' : ''}" 
             onclick="loadProductReviews(${currentProduct.id}, 1, 'all')">
             Tất Cả (${stats.all})
        </div>
    `;

    // ---- TẠO CÁC NÚT TỪ 5 SAO -> 1 SAO ----
    // Duyệt ngược từ 5 về 1 để hiển thị đúng thứ tự
    for (let i = 5; i >= 1; i--) {
        // Thêm class "active" nếu đang filter số sao này
        html += `
            <div class="rating-filter-btn ${activeRating == i ? 'active' : ''}" 
                 onclick="loadProductReviews(${currentProduct.id}, 1, ${i})">
                 ${i} Sao (${stats[i]})
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ---- HÀM TẠO PHÂN TRANG CHO REVIEW ----
// Mục đích: Render các nút chuyển trang (Prev, 1, 2, 3, Next)
// Params:
//   - pagination: Object {page: 1, totalPages: 5, limit: 5, total: 25}
function renderReviewPagination(pagination) {
    const container = document.getElementById("review-pagination");
    container.innerHTML = "";

    // ---- KIỂM TRA CÓ CẦN PHÂN TRANG KHÔNG ----
    // Nếu chỉ có 1 trang hoặc ít hơn -> không cần render
    if (pagination.totalPages <= 1) return;

    let html = `<ul class="pagination">`;

    // ---- NÚT PREV (TRANG TRƯỚC) ----
    // Chỉ hiển thị nếu không phải trang đầu
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

    // ---- CÁC NÚT SỐ TRANG ----
    // Duyệt từ 1 đến totalPages
    for (let i = 1; i <= pagination.totalPages; i++) {
        // Thêm class "active" cho trang hiện tại
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

    // ---- NÚT NEXT (TRANG SAU) ----
    // Chỉ hiển thị nếu không phải trang cuối
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