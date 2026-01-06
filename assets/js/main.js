/* =========================================================
   TWIN SHOP - MAIN.JS
   =========================================================
   
   Đây là file JAVASCRIPT CHÍNH của website (phía Frontend)
   
   CHỨC NĂNG CHÍNH:
   1. Load Components
      - Tải header.html và footer.html vào trang
   
   2. Sản phẩm
      - Gọi API lấy danh sách sản phẩm
      - Render HTML cho từng product card
      - Xử lý lọc, sắp xếp, phân trang
   
   3. Tìm kiếm
      - Xử lý thanh tìm kiếm
      - Lưu lịch sử tìm kiếm vào localStorage
   
   4. Đăng nhập/Đăng ký
      - Hiển thị modal form
      - Gọi API đăng nhập/đăng ký
      - Lưu thông tin user vào localStorage
   
   5. Giỏ hàng
      - Hiển thị số lượng trong header
      - Xem nhanh giỏ hàng (dropdown)
   
   6. Mobile Navigation
      - Menu drawer cho mobile
      - Toggle open/close
   
   ========================================================= */

// =========================================================
// CẤU HÌNH API ENDPOINTS
// =========================================================

// Base URL của API (relative path - tự thêm domain hiện tại)
const apiUrl = "/api";

// URL lấy danh sách sản phẩm
const productsApi = `${apiUrl}/products`;

// =========================================================
// STATE (TRẠNG THÁI) - Lưu bộ lọc hiện tại
// =========================================================

/*
 * currentFilter lưu các tham số lọc sản phẩm hiện tại
 * Khi thay đổi filter, gọi loadProducts() để fetch lại dữ liệu
 */
let currentFilter = {
    page: 1,              // Trang hiện tại
    limit: 10,            // Số sản phẩm mỗi trang
    search: "",           // Từ khóa tìm kiếm
    sort: "newest",       // Sắp xếp: newest, sold, price_asc, price_desc
    categoryId: ""        // ID danh mục (rỗng = tất cả)
};

// =========================================================
// 1. TẢI COMPONENT (HEADER, FOOTER, MODAL)
// =========================================================

/**
 * Load các component dùng chung vào trang
 * 
 * Tại sao cần hàm này?
 * - Header và Footer giống nhau ở mọi trang
 * - Thay vì copy-paste HTML, ta tách ra file riêng
 * - Dùng JavaScript fetch về và chèn vào placeholder
 * 
 * Flow:
 * 1. Fetch header.html -> Chèn vào #header-placeholder
 * 2. Fetch footer.html -> Chèn vào #footer-placeholder
 * 3. Gọi start() để khởi chạy các logic khác
 * 4. Gán sự kiện cho các nút trong header/footer
 */
async function loadComponents() {
    try {
        // A. Tải Header
        const headerRes = await fetch('./components/header.html');
        if (headerRes.ok) {
            const headerHtml = await headerRes.text();
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) headerPlaceholder.innerHTML = headerHtml;
        }

        // B. Tải Footer
        const footerRes = await fetch('./components/footer.html');
        if (footerRes.ok) {
            const footerHtml = await footerRes.text();
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) footerPlaceholder.innerHTML = footerHtml;
        }

        // C. Khởi chạy logic chính
        start();
        
        // D. Gán sự kiện click cho các nút
        initHeaderFooterEvents();

    } catch (error) {
        console.error("Lỗi tải thành phần:", error);
    }
}

// Chạy loadComponents khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", loadComponents);

// =========================================================
// 2. KHỞI CHẠY ỨNG DỤNG
// =========================================================

/**
 * Hàm khởi chạy chính - được gọi sau khi load components
 * 
 * Thực hiện các công việc:
 * 1. Kiểm tra đăng nhập và cập nhật header
 * 2. Render số lượng giỏ hàng
 * 3. Render lịch sử tìm kiếm
 * 4. Load danh mục sản phẩm
 * 5. Kiểm tra URL có chứa từ khóa tìm kiếm không
 * 6. Load sản phẩm (nếu là trang chủ)
 */
function start() {
    // [QUAN TRỌNG] Kiểm tra đăng nhập và cập nhật avatar/tên trong header
    checkLoginStatus();
    
    // Cập nhật số lượng trong icon giỏ hàng
    renderCartHeader();
    
    // Hiển thị lịch sử tìm kiếm trong dropdown
    renderSearchHistory();
    
    // Load danh mục vào sidebar
    loadCategories();

    // Kiểm tra URL có chứa ?search=... không
    // (VD: Từ trang khác chuyển về với từ khóa tìm kiếm)
    const urlParams = new URLSearchParams(window.location.search);
    const searchKeyword = urlParams.get('search');
    if (searchKeyword) {
        const searchInput = document.getElementById("search-input");
        if(searchInput) searchInput.value = searchKeyword;
        currentFilter.search = searchKeyword;
    }

    // Chỉ load sản phẩm nếu đang ở trang có #product-list
    // (Trang chủ index.html có, các trang khác không có)
    if (document.getElementById("product-list")) {
        loadProducts();
    }
    
    // Gán sự kiện cho các nút lọc sản phẩm
    initBodyEvents();
}

// ... (Giữ nguyên các hàm sự kiện initHeaderFooterEvents, initBodyEvents, loadProducts, renderProducts như cũ) ...
// Để tiết kiệm không gian, tôi chỉ liệt kê hàm quan trọng checkLoginStatus bên dưới

// =========================================================
// 3. KHỞI TẠO SỰ KIỆN HEADER/FOOTER
// =========================================================

/**
 * Gán sự kiện (onclick) cho các phần tử trong header và footer
 * 
 * Các sự kiện bao gồm:
 * 1. Thanh tìm kiếm: Click nút tìm hoặc nhấn Enter
 * 2. Modal: Mở/đóng form đăng ký/đăng nhập
 * 3. Form submit: Xử lý đăng ký, đăng nhập
 * 4. Kênh người bán: Kiểm tra quyền admin
 */
function initHeaderFooterEvents() {
    // ===== 1. TÌM KIẾM =====
    // Gán sự kiện cho nút tìm kiếm và input
    const searchBtn = document.getElementById("search-btn");
    const searchInput = document.getElementById("search-input");
    
    // Click nút tìm kiếm → gọi handleSearch
    if (searchBtn) searchBtn.onclick = handleSearch;
    
    if (searchInput) {
        // Nhấn Enter trong input → tìm kiếm
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
        });
        // Focus input → hiện lịch sử tìm kiếm
        searchInput.addEventListener("focus", renderSearchHistory);
    }

    // ===== 2. MODAL ĐĂNG NHẬP/ĐĂNG KÝ =====
    // Lấy các phần tử liên quan đến modal
    const regBtn = document.getElementById("register-btn");
    const logBtn = document.getElementById("login-btn");
    const switchToLogin = document.getElementById("switch-to-login");
    const switchToRegister = document.getElementById("switch-to-register");
    const backBtns = document.querySelectorAll(".auth-form__controls-back");
    const modalOverlay = document.querySelector(".modal__overlay");

    // Mở modal tương ứng khi click
    if (regBtn) regBtn.onclick = () => openModal("register");
    if (logBtn) logBtn.onclick = () => openModal("login");
    if (switchToLogin) switchToLogin.onclick = () => openModal("login");
    if (switchToRegister) switchToRegister.onclick = () => openModal("register");
    
    // Đóng modal khi click overlay hoặc nút "Trở lại"
    if (modalOverlay) modalOverlay.onclick = closeModal;
    backBtns.forEach(btn => btn.onclick = closeModal);

    // ===== 3. SUBMIT FORM =====
    // Gán sự kiện cho các nút submit trong form
    const btnRegSubmit = document.querySelector('#register-form .btn--primary');
    const btnLogSubmit = document.querySelector('#login-form .btn--primary');
    const btnAdminSubmit = document.getElementById("admin-submit-btn");

    if (btnRegSubmit) btnRegSubmit.onclick = handleRegister;
    if (btnLogSubmit) btnLogSubmit.onclick = handleLogin;
    if (btnAdminSubmit) btnAdminSubmit.onclick = handleAdminLogin;

    // ===== 4. KÊNH NGƯỜI BÁN (Admin) =====
    const sellerBtn = document.getElementById("seller-channel-btn");
    if (sellerBtn) {
        sellerBtn.onclick = function () {
            // Kiểm tra xem user đã đăng nhập chưa
            const user = safeJSONParse(localStorage.getItem('user_login'));
            
            if (!user) {
                // Chưa đăng nhập → mở form đăng nhập admin
                openModal("admin");
            } else if (user.role === 1) {
                // Đã đăng nhập + là admin → chuyển đến trang admin
                window.location.href = "admin.html";
            } else {
                // Đã đăng nhập nhưng không phải admin
                alert("Chỉ dành cho Admin!");
            }
        };
    }
}

// =========================================================
// 4. SỰ KIỆN TRONG BODY (LỌC SẢN PHẨM)
// =========================================================

/**
 * Gán sự kiện cho các nút lọc/sắp xếp sản phẩm
 * 
 * Có 2 loại:
 * 1. Nút lọc: Mới nhất, Bán chạy, Phổ biến
 * 2. Dropdown giá: Thấp → Cao, Cao → Thấp
 */
function initBodyEvents() {
    // ===== NÚT SẮP XẾP =====
    // Các nút: Mới nhất, Bán chạy, Phổ biến
    const filterBtns = document.querySelectorAll(".home-filter__btn");
    
    filterBtns.forEach(btn => {
        btn.onclick = function() {
            // Bỏ active tất cả nút, thêm active cho nút được click
            filterBtns.forEach(b => b.classList.remove("btn--primary")); 
            this.classList.add("btn--primary"); 

            // Xác định kiểu sắp xếp dựa vào text của nút
            const text = this.innerText.trim();
            if (text === "Mới nhất") currentFilter.sort = "newest";
            if (text === "Bán chạy") currentFilter.sort = "sold";
            if (text === "Phổ biến") currentFilter.sort = "popular";

            // Reset về trang 1 và load lại sản phẩm
            currentFilter.page = 1;
            loadProducts();
        }
    });

    // ===== DROPDOWN GIÁ =====
    // Sắp xếp theo giá tăng/giảm
    const sortAsc = document.getElementById("sort-asc");
    const sortDesc = document.getElementById("sort-desc");
    const sortLabel = document.querySelector(".select-input__label");

    if (sortAsc) {
        sortAsc.onclick = (e) => {
            e.preventDefault();  // Ngăn link reload trang
            currentFilter.sort = "price_asc";
            currentFilter.page = 1;
            // Cập nhật text và màu cho label dropdown
            if(sortLabel) { 
                sortLabel.innerText = "Giá: Thấp đến cao"; 
                sortLabel.style.color = "var(--primary-color)"; 
            }
            loadProducts();
        }
    }
    
    if (sortDesc) {
        sortDesc.onclick = (e) => {
            e.preventDefault();
            currentFilter.sort = "price_desc";
            currentFilter.page = 1;
            if(sortLabel) { 
                sortLabel.innerText = "Giá: Cao đến thấp"; 
                sortLabel.style.color = "var(--primary-color)"; 
            }
            loadProducts();
        }
    }
}

// =========================================================
// 5. LOAD VÀ RENDER SẢN PHẨM
// =========================================================

/**
 * Gọi API lấy danh sách sản phẩm
 * 
 * Luồng hoạt động:
 * 1. Build URL với các tham số filter (search, category, sort, page)
 * 2. Hiển thị loading spinner
 * 3. Fetch API products
 * 4. Render sản phẩm + pagination
 */
function loadProducts() {
    // Chuyển object currentFilter thành query string
    // VD: { page: 1, sort: 'newest' } → "page=1&sort=newest"
    const params = new URLSearchParams(currentFilter).toString();
    const productListEl = document.getElementById("product-list");
    
    // Hiển thị loading spinner trong khi chờ API
    if(productListEl)
        productListEl.innerHTML = '<div style="width:100%; text-align:center; padding:50px; font-size:1.4rem; color:#777;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

    // Gọi API với các tham số filter
    fetch(`${productsApi}?${params}`)
        .then(res => res.json())
        .then(response => {
            // Render sản phẩm từ response.data
            renderProducts(response.data);
            // Render pagination từ response.pagination
            renderPagination(response.pagination);
            // Cập nhật số trang trên thanh filter
            renderTopFilter(response.pagination); 
        })
        .catch(err => {
            console.error(err);
            if(productListEl) productListEl.innerHTML = '<div style="width:100%; text-align:center;">Lỗi kết nối!</div>';
        });
}

/**
 * Render danh sách sản phẩm ra HTML
 * 
 * @param {Array} products - Mảng các sản phẩm từ API
 * 
 * Mỗi sản phẩm sẽ được render thành một card:
 * - Ảnh thumbnail
 * - Tên sản phẩm
 * - Giá (gốc + giảm giá)
 * - Rating + Số lượng đã bán
 */
function renderProducts(products) {
    const productListElement = document.getElementById("product-list");
    if (!productListElement) return;

    // Trường hợp không có sản phẩm nào
    if (products.length === 0) {
        productListElement.innerHTML = `
            <div style="width:100%; text-align:center; font-size:1.6rem; padding: 50px;">
                <img src="./assets/img/no_cart.png" style="width:100px; opacity:0.5">
                <p style="margin-top:10px">Không tìm thấy sản phẩm nào!</p>
            </div>`;
        return;
    }

    // Map mỗi product thành HTML card
    const htmls = products.map((product) => {
        // Tính giá sau khi giảm
        const originalPrice = parseInt(product.price);
        const discount = product.discount_percentage || 0;
        const salePrice = Math.round((originalPrice * (100 - discount)) / 100);
        
        // Fallback nếu không có ảnh
        const imgUrl = product.thumbnail || "https://via.placeholder.com/300";
        
        // Format rating (1 chữ số thập phân)
        const rating = product.rating ? parseFloat(product.rating).toFixed(1) : "5.0";

        return `
            <div class="grid__column-2-4">
                <a class="home-product-item" href="product-detail.html?id=${product.id}">
                    <div class="home-product-item__img" style="background-image: url('${imgUrl}');"></div>
                    <h4 class="home-product-item__name">${product.name}</h4>
                    <div class="home-product-item__price">
                        <span class="home-product-item__price-current">${formatCurrency(salePrice)}</span>
                        <span class="home-product-item__currency" style="color: #ee4d2d; font-size:1.4rem"></span>
                        ${discount > 0 ? `<span class="home-product-item__discount">-${discount}%</span>` : ''}
                    </div>
                    <div class="home-product-item__voucher">
                        <span class="home-product-item__voucher-label">Giảm 35k₫</span>
                    </div>
                    <div class="home-product-item__meta">
                        <div class="home-product-item__rating">
                            <i class="home-product-item__star--gold fa-solid fa-star"></i>
                            <span class="home-product-item__rating-score">${rating}</span>
                        </div>
                        <span class="home-product-item__sold">Đã bán ${product.sold}</span>
                    </div>
                </a>
            </div>
        `;
    });
    
    // Join các HTML thành 1 chuỗi và gán vào container
    productListElement.innerHTML = htmls.join("");
}

// =========================================================
// 6. PAGINATION (PHÂN TRANG)
// =========================================================

/**
 * Cập nhật thanh filter trên đầu trang
 * Hiển thị: "Trang X/Y" và enable/disable nút prev/next
 */
function renderTopFilter(pagination) {
    const pageNumEl = document.querySelector(".home-filter__page-num");
    const prevBtn = document.querySelector(".home-filter__page-btn:first-child");
    const nextBtn = document.querySelector(".home-filter__page-btn:last-child");

    // Hiển thị số trang: "1/5"
    if (pageNumEl) {
        pageNumEl.innerHTML = `<span class="home-filter__page-current">${pagination.page}</span>/${pagination.totalPages}`;
    }
    
    // Xử lý nút Previous
    if (prevBtn) {
        if (pagination.page <= 1) {
            // Đang ở trang 1 → disable nút prev
            prevBtn.classList.add("home-filter__page-btn--disable");
            prevBtn.onclick = null;
        } else {
            prevBtn.classList.remove("home-filter__page-btn--disable");
            prevBtn.onclick = (e) => { e.preventDefault(); changePage(pagination.page - 1); };
        }
    }
    
    // Xử lý nút Next
    if (nextBtn) {
        if (pagination.page >= pagination.totalPages) {
            // Đang ở trang cuối → disable nút next
            nextBtn.classList.add("home-filter__page-btn--disable");
            nextBtn.onclick = null;
        } else {
            nextBtn.classList.remove("home-filter__page-btn--disable");
            nextBtn.onclick = (e) => { e.preventDefault(); changePage(pagination.page + 1); };
        }
    }
}

/**
 * Render thanh pagination dưới cùng
 * 
 * Logic hiển thị:
 * - ≤5 trang: Hiện tất cả (1, 2, 3, 4, 5)
 * - >5 trang: Hiện kiểu "1 ... 4 5 6 ... 10"
 *   + Luôn hiện trang đầu và cuối
 *   + Hiện 3 trang quanh trang hiện tại
 *   + Dấu "..." khi có gap
 */
function renderPagination(pagination) {
    const paginationElement = document.querySelector(".pagination");
    if (!paginationElement) return;

    const { page, totalPages } = pagination;
    let html = "";
    
    // Helper function tạo link pagination
    const createLink = (p, text, active = false) => `<li class="pagination-item ${active ? 'pagination-item--active' : ''}"><a href="javascript:void(0)" onclick="changePage(${p})" class="pagination-item__link">${text}</a></li>`;
    const createIcon = (p, iconClass) => `<li class="pagination-item"><a href="javascript:void(0)" onclick="changePage(${p})" class="pagination-item__link"><i class="pagination-item__icon fa-solid ${iconClass}"></i></a></li>`;

    if (totalPages <= 5) {
        // Ít trang → hiện tất cả
        for (let i = 1; i <= totalPages; i++) html += createLink(i, i, i === page);
    } else {
        // Nhiều trang → logic phức tạp hơn
        if (page > 1) html += createIcon(page - 1, 'fa-angle-left');  // Nút prev
        html += createLink(1, 1, 1 === page);  // Trang 1
        
        // Tính range hiển thị (3 trang quanh trang hiện tại)
        let start = page - 1; let end = page + 1;
        if (page <= 2) { start = 2; end = 4; }
        if (page >= totalPages - 1) { start = totalPages - 3; end = totalPages - 1; }
        
        if (start > 2) html += `<li class="pagination-item"><span class="pagination-item__link">...</span></li>`;
        
        for (let i = start; i <= end; i++) { 
            if (i > 1 && i < totalPages) html += createLink(i, i, i === page); 
        }
        
        if (end < totalPages - 1) html += `<li class="pagination-item"><span class="pagination-item__link">...</span></li>`;
        
        html += createLink(totalPages, totalPages, totalPages === page);  // Trang cuối
        if (page < totalPages) html += createIcon(page + 1, 'fa-angle-right');  // Nút next
    }
    
    paginationElement.innerHTML = html;
}

/**
 * Chuyển đến trang mới
 * - Cập nhật currentFilter.page
 * - Load lại sản phẩm
 * - Scroll lên đầu container
 */
window.changePage = function(newPage) {
    currentFilter.page = newPage;
    loadProducts();
    // Scroll mượt lên đầu phần sản phẩm
    const container = document.querySelector('.app__container');
    if(container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =========================================================
// 7. DANH MỤC SẢN PHẨM (SIDEBAR)
// =========================================================

/**
 * Load danh mục sản phẩm từ API và render vào sidebar
 * 
 * - Gọi API /categories
 * - Render thành list items
 * - Highlight danh mục đang được chọn
 */
function loadCategories() {
    fetch(`${apiUrl}/categories`)
        .then(res => res.json())
        .then(categories => {
            const listBlock = document.getElementById('category-list');
            if(!listBlock) return;
            
            // Tạo item "Tất cả sản phẩm" + active nếu không filter theo category
            let html = `<li class="category-item ${currentFilter.categoryId === "" ? "category-item--active" : ""}"><a href="javascript:void(0)" onclick="filterCategory('')" class="category-item__link">Tất cả sản phẩm</a></li>`;
            
            // Map các category thành list items
            html += categories.map(cat => `<li class="category-item ${currentFilter.categoryId == cat.id ? "category-item--active" : ""}"><a href="javascript:void(0)" onclick="filterCategory(${cat.id})" class="category-item__link">${cat.name}</a></li>`).join("");
            
            listBlock.innerHTML = html;
        }).catch(err => console.error(err));
}

/**
 * Filter sản phẩm theo danh mục
 * @param {number|string} catId - ID của category, hoặc '' để xem tất cả
 */
window.filterCategory = function(catId) {
    currentFilter.categoryId = catId;
    currentFilter.page = 1;  // Reset về trang 1
    loadCategories();  // Re-render sidebar để highlight
    loadProducts();  // Load sản phẩm với filter mới
}

// =========================================================
// 8. TÌM KIẾM SẢN PHẨM
// =========================================================

/**
 * Xử lý tìm kiếm sản phẩm
 * 
 * Có 2 trường hợp:
 * 1. Đang ở trang chủ → tìm trực tiếp (không reload)
 * 2. Đang ở trang khác → chuyển về trang chủ với query param
 */
function handleSearch() {
    const searchInput = document.getElementById("search-input");
    const keyword = searchInput ? searchInput.value.trim() : "";
    
    // Thêm từ khóa vào lịch sử tìm kiếm
    if(keyword) addToHistory(keyword);

    // Kiểm tra đang ở trang nào
    const path = window.location.pathname;
    const isHome = path.endsWith("index.html") || path === "/" || path.endsWith("/twin-shop/");

    if (!isHome) {
        // Đang ở trang khác → chuyển về index với ?search=...
        if(keyword) window.location.href = `index.html?search=${encodeURIComponent(keyword)}`;
        return;
    }
    
    // Đang ở trang chủ → filter trực tiếp
    currentFilter.search = keyword;
    currentFilter.page = 1;
    loadProducts();
}

/**
 * Render dropdown lịch sử tìm kiếm
 * 
 * - Lấy lịch sử từ localStorage
 * - Render thành dropdown list
 * - Có nút xóa từng item và xóa tất cả
 */
function renderSearchHistory() {
    const historyList = safeJSONParse(localStorage.getItem("search_history")) || [];
    const historyContainer = document.querySelector(".header__search-history"); 
    if (!historyContainer) return;

    if (historyList.length > 0) {
        // Render từng item lịch sử
        const listItemsHtml = historyList.map(kw => `
            <li class="header__search-history-item" style="display: flex; justify-content: space-between; align-items: center; height: 38px;">
                <a href="javascript:void(0)" onmousedown="applySearch('${kw}')" style="flex: 1; display: flex; align-items: center; height: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; font-size: 1.4rem;">${kw}</a>
                <span onmousedown="deleteFromHistory('${kw}', event)" style="cursor: pointer; padding: 0 10px; color: #ccc; font-size: 1.2rem; height: 100%; display: flex; align-items: center;"><i class="fa-solid fa-xmark"></i></span>
            </li>
        `).join("");
        
        // Nút xóa tất cả (chỉ hiện khi có >2 items)
        let clearAllHtml = "";
        if (historyList.length > 2) {
            clearAllHtml = `<li class="header__search-history-item" onmousedown="deleteAllHistory(event)" style="text-align: center; color: #777; font-weight: 500; border-top: 1px solid #f1f1f1; justify-content: center; height: 38px; display: flex; align-items: center; font-size: 1.4rem;">Xóa tất cả lịch sử tìm kiếm</li>`;
        }
        
        historyContainer.innerHTML = `<h3 class="header__search-history-heading">Lịch sử tìm kiếm</h3><ul class="header__search-history-list" id="search-history-list">${listItemsHtml}${clearAllHtml}</ul>`;
    } else {
        historyContainer.innerHTML = `<div class="header__search-history-heading" style="text-align: center; margin-bottom: 12px;">Chưa có lịch sử</div>`;
    }
}

/**
 * Thêm từ khóa vào lịch sử tìm kiếm
 * - Giới hạn 5 từ khóa gần nhất
 * - Từ khóa mới nhất ở đầu
 */
function addToHistory(keyword) {
    if(!keyword) return;
    let history = safeJSONParse(localStorage.getItem("search_history")) || [];
    // Xóa nếu đã tồn tại (để đưa lên đầu)
    history = history.filter(k => k !== keyword);
    // Thêm vào đầu mảng
    history.unshift(keyword);
    // Giới hạn 5 items
    if(history.length > 5) history.pop(); 
    localStorage.setItem("search_history", JSON.stringify(history));
    renderSearchHistory();
}

// Áp dụng tìm kiếm từ lịch sử (khi click vào item)
window.applySearch = function(kw) {
    const searchInput = document.getElementById("search-input");
    if(searchInput) searchInput.value = kw;
    handleSearch();
}

// Xóa 1 item khỏi lịch sử
window.deleteFromHistory = function(keyword, event) {
    event.stopPropagation(); event.preventDefault();
    let history = safeJSONParse(localStorage.getItem("search_history")) || [];
    history = history.filter(k => k !== keyword);
    localStorage.setItem("search_history", JSON.stringify(history));
    renderSearchHistory();
    const searchInput = document.getElementById("search-input");
    if(searchInput) searchInput.focus();
}

// Xóa toàn bộ lịch sử
window.deleteAllHistory = function(event) {
    event.stopPropagation(); event.preventDefault();
    if(confirm("Xóa toàn bộ lịch sử?")) {
        localStorage.removeItem("search_history");
        renderSearchHistory();
        const searchInput = document.getElementById("search-input");
        if(searchInput) searchInput.focus();
    }
}

// =========================================================
// 9. KIỂM TRA ĐĂNG NHẬP & CẬP NHẬT HEADER
// =========================================================

/**
 * Kiểm tra trạng thái đăng nhập và cập nhật header
 * 
 * Nếu đã đăng nhập:
 * - Hiện avatar + tên user
 * - Hiện dropdown menu: Tài khoản, Đơn mua, Đăng xuất
 * 
 * Nếu chưa đăng nhập:
 * - Hiện nút Đăng ký / Đăng nhập
 */
function checkLoginStatus() {
    const user = safeJSONParse(localStorage.getItem('user_login'));
    
    // Tìm vùng menu user trong header (ul cuối cùng của navbar)
    const navbarList = document.querySelector('.header__navbar-list:last-child'); 
    
    if (user && navbarList) {
        // ĐÃ ĐĂNG NHẬP - Render avatar + dropdown menu
        navbarList.innerHTML = `
            <li class="header__navbar-item header__navbar-item--separate"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-bell"></i> Thông báo</a></li>
            <li class="header__navbar-item"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-circle-question"></i> Trợ giúp</a></li>
            <li class="header__navbar-item header__navbar-user" style="position: relative; cursor: pointer;">
                <img src="${user.avatar || 'https://ui-avatars.com/api/?name='+user.full_name+'&background=random'}" class="header__navbar-user-img" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border: 1px solid rgba(0,0,0,0.1);">
                <span class="header__navbar-user-name" style="margin-left: 4px; font-weight: 500;">${user.full_name}</span>
                <ul class="header__navbar-user-menu">
                    <li class="header__navbar-user-item"><a href="user.html?tab=profile">Tài khoản của tôi</a></li>
                    <li class="header__navbar-user-item"><a href="user.html?tab=orders">Đơn mua</a></li>
                    <li class="header__navbar-user-item header__navbar-user-item--separate"><a href="javascript:void(0)" onclick="logout()">Đăng xuất</a></li>
                </ul>
            </li>
        `;
    } else if (navbarList) {
        // CHƯA ĐĂNG NHẬP - Render nút Đăng ký / Đăng nhập
        navbarList.innerHTML = `
            <li class="header__navbar-item header__navbar-item--separate"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-bell"></i> Thông báo</a></li>
            <li class="header__navbar-item"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-circle-question"></i> Trợ giúp</a></li>
            <li class="header__navbar-item header__navbar-item--strong header__navbar-item--separate" id="register-btn">Đăng ký</li>
            <li class="header__navbar-item header__navbar-item--strong" id="login-btn">Đăng nhập</li>
        `;
    }
}

/**
 * Đăng xuất - Xóa thông tin user và reload trang
 */
window.logout = function() { 
    if(confirm("Đăng xuất?")) { 
        localStorage.removeItem('user_login'); 
        localStorage.removeItem('checkout_items'); 
        window.location.href = "index.html"; 
    } 
}

// =========================================================
// 10. XỬ LÝ FORM ĐĂNG KÝ / ĐĂNG NHẬP
// =========================================================

/**
 * Xử lý đăng ký tài khoản mới
 * 
 * Luồng:
 * 1. Lấy giá trị từ các input
 * 2. Validate email, password, confirm password
 * 3. Nếu hợp lệ → gọi API /register
 * 4. Đăng ký thành công → chuyển sang form đăng nhập
 */
function handleRegister() {
    // Lấy các input trong form đăng ký
    const inputs = document.querySelectorAll('#register-form .auth-form__input');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    const rePassInput = inputs[2];
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const rePass = rePassInput.value.trim();
    
    // ===== VALIDATE =====
    // Sử dụng Validator object từ validation.js
    let isValid = true;
    
    // Validate Email
    const emailResult = Validator.validateEmail(email);
    if (!emailResult.isValid) {
        Validator.showError(emailInput, emailResult.message);
        isValid = false;
    } else {
        Validator.clearError(emailInput);
    }
    
    // Validate Password (độ dài, ký tự đặc biệt...)
    const passResult = Validator.validatePassword(password);
    if (!passResult.isValid) {
        Validator.showError(passwordInput, passResult.message);
        isValid = false;
    } else {
        Validator.clearError(passwordInput);
    }
    
    // Validate Confirm Password (phải trùng với password)
    const confirmResult = Validator.validateConfirmPassword(password, rePass);
    if (!confirmResult.isValid) {
        Validator.showError(rePassInput, confirmResult.message);
        isValid = false;
    } else {
        Validator.clearError(rePassInput);
    }
    
    // Dừng nếu có lỗi
    if (!isValid) return;
    
    // ===== GỌI API ĐĂNG KÝ =====
    fetch(`${apiUrl}/register`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            full_name: email.split('@')[0],  // Tạo tên từ email
            email, 
            password 
        }) 
    })
    .then(r => r.json())
    .then(d => { 
        alert(d.message); 
        // Nếu thành công → mở form đăng nhập
        if(d.message.includes("thành công")) openModal("login"); 
    })
    .catch(() => alert("Lỗi server"));
}

/**
 * Xử lý đăng nhập
 * 
 * Luồng:
 * 1. Validate email, password
 * 2. Gọi API /login
 * 3. Thành công → lưu user vào localStorage
 * 4. Nếu là admin → chuyển đến admin.html
 */
function handleLogin() {
    const inputs = document.querySelectorAll('#login-form .auth-form__input');
    const emailInput = inputs[0];
    const passwordInput = inputs[1];
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // ===== VALIDATE =====
    let isValid = true;
    
    // Validate Email
    const emailResult = Validator.validateEmail(email);
    if (!emailResult.isValid) {
        Validator.showError(emailInput, emailResult.message);
        isValid = false;
    } else {
        Validator.clearError(emailInput);
    }
    
    // Validate Password (chỉ check không rỗng)
    if (!password) {
        Validator.showError(passwordInput, 'Vui lòng nhập mật khẩu!');
        isValid = false;
    } else {
        Validator.clearError(passwordInput);
    }
    
    if (!isValid) return;
    
    // ===== GỌI API ĐĂNG NHẬP =====
    fetch(`${apiUrl}/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email, password }) 
    })
    .then(r => r.json())
    .then(d => {
        if(d.user) {
            alert("Đăng nhập thành công!"); 
            // Lưu thông tin user vào localStorage
            localStorage.setItem('user_login', JSON.stringify(d.user));
            // Admin → chuyển đến trang admin, User → reload trang hiện tại
            Number(d.user.role) === 1 ? window.location.href = 'admin.html' : window.location.reload();
        } else {
            alert(d.message);
        }
    })
    .catch(() => alert("Lỗi server"));
}

/**
 * Xử lý đăng nhập Admin
 * Tương tự handleLogin nhưng chỉ cho phép role = 1 (admin)
 */
function handleAdminLogin() {
    fetch(`${apiUrl}/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            email: document.getElementById("admin-email").value.trim(), 
            password: document.getElementById("admin-password").value.trim() 
        }) 
    })
    .then(r => r.json())
    .then(d => {
        // Kiểm tra cả đăng nhập thành công VÀ là admin
        if(d.user && Number(d.user.role) === 1) { 
            localStorage.setItem('user_login', JSON.stringify(d.user)); 
            window.location.href = 'admin.html'; 
        } else {
            alert("Không có quyền truy cập!");
        }
    });
}

// =========================================================
// 11. MODAL - MỞ/ĐÓNG FORM
// =========================================================

/**
 * Mở modal và hiển thị form tương ứng
 * @param {string} type - 'register', 'login', hoặc 'admin'
 */
function openModal(type) {
    const modal = document.querySelector(".modal");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const adminLoginForm = document.getElementById("admin-login-form");

    // Hiện modal container
    if (modal) modal.style.display = "flex";
    
    // Ẩn tất cả các form trước
    if (registerForm) registerForm.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (adminLoginForm) adminLoginForm.style.display = "none";

    // Hiện form được yêu cầu
    if (type === "register" && registerForm) registerForm.style.display = "block";
    if (type === "login" && loginForm) loginForm.style.display = "block";
    if (type === "admin" && adminLoginForm) adminLoginForm.style.display = "block";
}

/**
 * Đóng modal
 */
function closeModal() {
    const modal = document.querySelector(".modal");
    if (modal) modal.style.display = "none";
}

// =========================================================
// 12. GIỎ HÀNG - RENDER HEADER CART
// =========================================================

/**
 * Render giỏ hàng trong header (dropdown preview)
 * 
 * - Hiển thị số lượng trên icon
 * - Render danh sách sản phẩm trong dropdown
 */
function renderCartHeader() {
    const user = safeJSONParse(localStorage.getItem('user_login'));
    const cartList = document.querySelector(".header__cart-list");
    const cartNotice = document.querySelector(".header__cart-notice");
    
    // Chưa đăng nhập → hiện 0
    if (!user) { 
        if (cartNotice) cartNotice.innerText = "0"; 
        return; 
    }

    // Gọi API lấy giỏ hàng của user
    fetch(`${apiUrl}/cart/${user.id}`)
        .then(r => r.json())
        .then(cart => {
            // Cập nhật badge số lượng
            if (cartNotice) cartNotice.innerText = cart.length;
            
            if (!cartList) return;
            
            if (cart.length === 0) {
                // Giỏ hàng trống
                cartList.classList.add("header__cart-list--no-cart");
                cartList.innerHTML = `<img src="./assets/img/no_cart.png" class="header__cart-no-cart-img"><span class="header__cart-list--no-cart-msg">Giỏ hàng trống</span>`;
            } else {
                // Có sản phẩm → render list
                cartList.classList.remove("header__cart-list--no-cart");
                let html = `<h4 class="header__cart-heading">Sản phẩm đã thêm</h4><ul class="header__cart-list-item">`;
                
                html += cart.map(item => `
                    <li class="header__cart-item" onclick="window.location.href='product-detail.html?id=${item.product_id}'">
                        <img src="${item.thumbnail || 'https://via.placeholder.com/100'}" class="header__cart-img">
                        <div class="header__cart-item-info">
                            <div class="header__cart-item-head"><h5 class="header__cart-item-name">${item.name}</h5><div class="header__cart-item-price-wrap"><span class="header__cart-item-price">${formatCurrency(item.price)}</span><span class="header__cart-item-multiply">x</span><span class="header__cart-item-qnt">${item.quantity}</span></div></div>
                            <div class="header__cart-item-body"><span class="header__cart-item-description">Phân loại: ${item.color || 'Mặc định'}${item.size ? ', ' + item.size : ''}</span></div>
                        </div>
                    </li>`).join("");
                    
                html += `</ul><a href="cart.html" class="header__cart-view-cart btn btn--primary">Xem giỏ hàng</a>`;
                cartList.innerHTML = html;
            }
        })
        .catch(e => console.log(e));
}

// Alias để các file khác có thể gọi (tương thích cũ)
const updateCartCount = renderCartHeader;

// =========================================================
// 13. UTILITY FUNCTIONS
// =========================================================

/**
 * Format số thành tiền VNĐ
 * VD: 1000000 → "1.000.000 ₫"
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", {
        style: 'currency', 
        currency: 'VND'
    }).format(amount);
}

// =========================================================
// 14. MOBILE NAVIGATION - Menu drawer trên điện thoại
// =========================================================

/**
 * Toggle (bật/tắt) menu drawer trên mobile
 * 
 * Cách hoạt động:
 * - Thêm/xóa class 'active' cho nav và overlay
 * - Khóa scroll body khi menu mở
 */
function toggleMobileNav() {
    const nav = document.getElementById("mobile-nav");
    const overlay = document.querySelector(".mobile-menu-overlay");
    
    if (nav && overlay) {
        // Toggle class 'active' - CSS sẽ dựa vào class này để show/hide
        nav.classList.toggle("active");
        overlay.classList.toggle("active");
        
        // Quan trọng: Khóa scroll body khi menu mở
        // Để người dùng không thể scroll trang phía sau menu
        document.body.style.overflow = nav.classList.contains("active") ? "hidden" : "";
    }
}

/**
 * Cập nhật thông tin user trong mobile navigation
 * 
 * Nếu đã đăng nhập:
 * - Hiện avatar, tên, email
 * - Ẩn nút Đăng nhập/Đăng ký
 * - Hiện menu: Tài khoản, Đơn hàng, Đăng xuất
 * 
 * Nếu chưa đăng nhập:
 * - Hiện "Chào bạn!" + nút Đăng nhập/Đăng ký
 */
function updateMobileNav() {
    const userStr = localStorage.getItem("user_login");
    
    // Các element trong mobile nav
    const mobileNavName = document.getElementById("mobile-nav-name");
    const mobileNavEmail = document.getElementById("mobile-nav-email");
    const mobileNavAvatar = document.getElementById("mobile-nav-avatar");
    const loginBtn = document.getElementById("mobile-login-btn");
    const registerBtn = document.getElementById("mobile-register-btn");
    const userMenuItems = document.querySelectorAll(".mobile-nav__user-menu");

    if (userStr && userStr !== "undefined") {
        try {
            const user = JSON.parse(userStr);
            
            // Cập nhật tên và email
            if (mobileNavName) mobileNavName.textContent = user.full_name || "Người dùng";
            if (mobileNavEmail) mobileNavEmail.textContent = user.email || "";
            
            // Cập nhật avatar (nếu có)
            if (mobileNavAvatar) {
                if (user.avatar) {
                    // Có avatar → hiện ảnh với fallback về icon nếu ảnh lỗi
                    mobileNavAvatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user\\'></i>'" />`;
                }
            }
            
            // Ẩn nút đăng nhập/đăng ký
            if (loginBtn) loginBtn.style.display = "none";
            if (registerBtn) registerBtn.style.display = "none";
            
            // Hiện các menu item dành cho user đã đăng nhập
            userMenuItems.forEach(item => item.style.display = "block");
            
        } catch (e) {
            console.log("Parse user error", e);
        }
    } else {
        // Chưa đăng nhập: Hiện nút đăng nhập/đăng ký, ẩn menu user
        if (loginBtn) loginBtn.style.display = "block";
        if (registerBtn) registerBtn.style.display = "block";
        userMenuItems.forEach(item => item.style.display = "none");
    }
}

/**
 * Load danh mục sản phẩm vào mobile navigation
 * Tương tự loadCategories() nhưng cho mobile menu
 */
function loadMobileCategories() {
    const container = document.getElementById("mobile-category-list");
    if (!container) return;

    fetch(`${apiUrl}/categories`)
        .then(r => r.json())
        .then(categories => {
            // Render các category thành list items
            container.innerHTML = categories.map(cat => `
                <li class="mobile-nav__category-item">
                    <a href="index.html?category=${cat.id}" class="mobile-nav__category-link" onclick="toggleMobileNav()">
                        ${cat.name}
                    </a>
                </li>
            `).join("");
        })
        .catch(e => console.log("Load mobile categories error", e));
}

// =========================================================
// KHỞI TẠO KHI TRANG LOAD XONG
// =========================================================

// Gọi update mobile nav sau khi components load xong
document.addEventListener("DOMContentLoaded", () => {
    // Delay 500ms để đảm bảo header đã được load bởi loadComponents()
    setTimeout(() => {
        updateMobileNav();       // Cập nhật thông tin user trong mobile nav
        loadMobileCategories();  // Load danh mục vào mobile nav
    }, 500);
});