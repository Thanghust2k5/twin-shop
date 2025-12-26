const apiUrl = "/api";
const productsApi = `${apiUrl}/products`;

// Bộ lọc hiện tại (State)
let currentFilter = {
    page: 1,
    limit: 10,
    search: "",
    sort: "newest", 
    categoryId: ""
};

// =========================================================
// 1. TẢI COMPONENT (HEADER, FOOTER, MODAL)
// =========================================================
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

        // C. Logic chính
        start();
        
        // D. Gán sự kiện
        initHeaderFooterEvents();

    } catch (error) {
        console.error("Lỗi tải thành phần:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadComponents);

// =========================================================
// 2. KHỞI CHẠY ỨNG DỤNG
// =========================================================
function start() {
    // [QUAN TRỌNG] Kiểm tra trạng thái đăng nhập và CẬP NHẬT HEADER NGAY LẬP TỨC
    checkLoginStatus();
    
    renderCartHeader();
    renderSearchHistory();
    loadCategories();

    // Check URL search
    const urlParams = new URLSearchParams(window.location.search);
    const searchKeyword = urlParams.get('search');
    if (searchKeyword) {
        const searchInput = document.getElementById("search-input");
        if(searchInput) searchInput.value = searchKeyword;
        currentFilter.search = searchKeyword;
    }

    // Chỉ tải sản phẩm ở trang chủ
    if (document.getElementById("product-list")) {
        loadProducts();
    }
    
    initBodyEvents();
}

// ... (Giữ nguyên các hàm sự kiện initHeaderFooterEvents, initBodyEvents, loadProducts, renderProducts như cũ) ...
// Để tiết kiệm không gian, tôi chỉ liệt kê hàm quan trọng checkLoginStatus bên dưới

function initHeaderFooterEvents() {
    // 1. Tìm kiếm
    const searchBtn = document.getElementById("search-btn");
    const searchInput = document.getElementById("search-input");
    
    if (searchBtn) searchBtn.onclick = handleSearch;
    if (searchInput) {
        searchInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
        });
        searchInput.addEventListener("focus", renderSearchHistory);
    }

    // 2. Modal
    const regBtn = document.getElementById("register-btn");
    const logBtn = document.getElementById("login-btn");
    const switchToLogin = document.getElementById("switch-to-login");
    const switchToRegister = document.getElementById("switch-to-register");
    const backBtns = document.querySelectorAll(".auth-form__controls-back");
    const modalOverlay = document.querySelector(".modal__overlay");

    if (regBtn) regBtn.onclick = () => openModal("register");
    if (logBtn) logBtn.onclick = () => openModal("login");
    if (switchToLogin) switchToLogin.onclick = () => openModal("login");
    if (switchToRegister) switchToRegister.onclick = () => openModal("register");
    
    if (modalOverlay) modalOverlay.onclick = closeModal;
    backBtns.forEach(btn => btn.onclick = closeModal);

    // 3. Submit Form
    const btnRegSubmit = document.querySelector('#register-form .btn--primary');
    const btnLogSubmit = document.querySelector('#login-form .btn--primary');
    const btnAdminSubmit = document.getElementById("admin-submit-btn");

    if (btnRegSubmit) btnRegSubmit.onclick = handleRegister;
    if (btnLogSubmit) btnLogSubmit.onclick = handleLogin;
    if (btnAdminSubmit) btnAdminSubmit.onclick = handleAdminLogin;

    // 4. Kênh người bán
    const sellerBtn = document.getElementById("seller-channel-btn");
    if (sellerBtn) {
        sellerBtn.onclick = function () {
            const user = JSON.parse(localStorage.getItem('user_login'));
            if (!user) openModal("admin");
            else if (user.role === 1) window.location.href = "admin.html";
            else alert("Chỉ dành cho Admin!");
        };
    }
}

function initBodyEvents() {
    // Nút sắp xếp
    const filterBtns = document.querySelectorAll(".home-filter__btn");
    filterBtns.forEach(btn => {
        btn.onclick = function() {
            filterBtns.forEach(b => b.classList.remove("btn--primary")); 
            this.classList.add("btn--primary"); 

            const text = this.innerText.trim();
            if (text === "Mới nhất") currentFilter.sort = "newest";
            if (text === "Bán chạy") currentFilter.sort = "sold";
            if (text === "Phổ biến") currentFilter.sort = "popular";

            currentFilter.page = 1;
            loadProducts();
        }
    });

    // Dropdown giá
    const sortAsc = document.getElementById("sort-asc");
    const sortDesc = document.getElementById("sort-desc");
    const sortLabel = document.querySelector(".select-input__label");

    if (sortAsc) {
        sortAsc.onclick = (e) => {
            e.preventDefault();
            currentFilter.sort = "price_asc";
            currentFilter.page = 1;
            if(sortLabel) { sortLabel.innerText = "Giá: Thấp đến cao"; sortLabel.style.color = "var(--primary-color)"; }
            loadProducts();
        }
    }
    if (sortDesc) {
        sortDesc.onclick = (e) => {
            e.preventDefault();
            currentFilter.sort = "price_desc";
            currentFilter.page = 1;
            if(sortLabel) { sortLabel.innerText = "Giá: Cao đến thấp"; sortLabel.style.color = "var(--primary-color)"; }
            loadProducts();
        }
    }
}

function loadProducts() {
    const params = new URLSearchParams(currentFilter).toString();
    const productListEl = document.getElementById("product-list");
    
    if(productListEl)
        productListEl.innerHTML = '<div style="width:100%; text-align:center; padding:50px; font-size:1.4rem; color:#777;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

    fetch(`${productsApi}?${params}`)
        .then(res => res.json())
        .then(response => {
            renderProducts(response.data);
            renderPagination(response.pagination);
            renderTopFilter(response.pagination); 
        })
        .catch(err => {
            console.error(err);
            if(productListEl) productListEl.innerHTML = '<div style="width:100%; text-align:center;">Lỗi kết nối!</div>';
        });
}

function renderProducts(products) {
    const productListElement = document.getElementById("product-list");
    if (!productListElement) return;

    if (products.length === 0) {
        productListElement.innerHTML = `
            <div style="width:100%; text-align:center; font-size:1.6rem; padding: 50px;">
                <img src="./assets/img/no_cart.png" style="width:100px; opacity:0.5">
                <p style="margin-top:10px">Không tìm thấy sản phẩm nào!</p>
            </div>`;
        return;
    }

    const htmls = products.map((product) => {
        const originalPrice = parseInt(product.price);
        const discount = product.discount_percentage || 0;
        const salePrice = Math.round((originalPrice * (100 - discount)) / 100);
        const imgUrl = product.thumbnail || "https://via.placeholder.com/300";
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
    productListElement.innerHTML = htmls.join("");
}

function renderTopFilter(pagination) {
    const pageNumEl = document.querySelector(".home-filter__page-num");
    const prevBtn = document.querySelector(".home-filter__page-btn:first-child");
    const nextBtn = document.querySelector(".home-filter__page-btn:last-child");

    if (pageNumEl) {
        pageNumEl.innerHTML = `<span class="home-filter__page-current">${pagination.page}</span>/${pagination.totalPages}`;
    }
    if (prevBtn) {
        if (pagination.page <= 1) {
            prevBtn.classList.add("home-filter__page-btn--disable");
            prevBtn.onclick = null;
        } else {
            prevBtn.classList.remove("home-filter__page-btn--disable");
            prevBtn.onclick = (e) => { e.preventDefault(); changePage(pagination.page - 1); };
        }
    }
    if (nextBtn) {
        if (pagination.page >= pagination.totalPages) {
            nextBtn.classList.add("home-filter__page-btn--disable");
            nextBtn.onclick = null;
        } else {
            nextBtn.classList.remove("home-filter__page-btn--disable");
            nextBtn.onclick = (e) => { e.preventDefault(); changePage(pagination.page + 1); };
        }
    }
}

function renderPagination(pagination) {
    const paginationElement = document.querySelector(".pagination");
    if (!paginationElement) return;

    const { page, totalPages } = pagination;
    let html = "";
    const createLink = (p, text, active = false) => `<li class="pagination-item ${active ? 'pagination-item--active' : ''}"><a href="javascript:void(0)" onclick="changePage(${p})" class="pagination-item__link">${text}</a></li>`;
    const createIcon = (p, iconClass) => `<li class="pagination-item"><a href="javascript:void(0)" onclick="changePage(${p})" class="pagination-item__link"><i class="pagination-item__icon fa-solid ${iconClass}"></i></a></li>`;

    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) html += createLink(i, i, i === page);
    } else {
        if (page > 1) html += createIcon(page - 1, 'fa-angle-left');
        html += createLink(1, 1, 1 === page);
        let start = page - 1; let end = page + 1;
        if (page <= 2) { start = 2; end = 4; }
        if (page >= totalPages - 1) { start = totalPages - 3; end = totalPages - 1; }
        if (start > 2) html += `<li class="pagination-item"><span class="pagination-item__link">...</span></li>`;
        for (let i = start; i <= end; i++) { if (i > 1 && i < totalPages) html += createLink(i, i, i === page); }
        if (end < totalPages - 1) html += `<li class="pagination-item"><span class="pagination-item__link">...</span></li>`;
        html += createLink(totalPages, totalPages, totalPages === page);
        if (page < totalPages) html += createIcon(page + 1, 'fa-angle-right');
    }
    paginationElement.innerHTML = html;
}

window.changePage = function(newPage) {
    currentFilter.page = newPage;
    loadProducts();
    const container = document.querySelector('.app__container');
    if(container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadCategories() {
    fetch(`${apiUrl}/categories`)
        .then(res => res.json())
        .then(categories => {
            const listBlock = document.getElementById('category-list');
            if(!listBlock) return;
            let html = `<li class="category-item ${currentFilter.categoryId === "" ? "category-item--active" : ""}"><a href="javascript:void(0)" onclick="filterCategory('')" class="category-item__link">Tất cả sản phẩm</a></li>`;
            html += categories.map(cat => `<li class="category-item ${currentFilter.categoryId == cat.id ? "category-item--active" : ""}"><a href="javascript:void(0)" onclick="filterCategory(${cat.id})" class="category-item__link">${cat.name}</a></li>`).join("");
            listBlock.innerHTML = html;
        }).catch(err => console.error(err));
}

window.filterCategory = function(catId) {
    currentFilter.categoryId = catId;
    currentFilter.page = 1;
    loadCategories();
    loadProducts();
}

function handleSearch() {
    const searchInput = document.getElementById("search-input");
    const keyword = searchInput ? searchInput.value.trim() : "";
    
    if(keyword) addToHistory(keyword);

    const path = window.location.pathname;
    const isHome = path.endsWith("index.html") || path === "/" || path.endsWith("/twin-shop/");

    if (!isHome) {
        if(keyword) window.location.href = `index.html?search=${encodeURIComponent(keyword)}`;
        return;
    }
    currentFilter.search = keyword;
    currentFilter.page = 1;
    loadProducts();
}

function renderSearchHistory() {
    const historyList = JSON.parse(localStorage.getItem("search_history")) || [];
    const historyContainer = document.querySelector(".header__search-history"); 
    if (!historyContainer) return;

    if (historyList.length > 0) {
        const listItemsHtml = historyList.map(kw => `
            <li class="header__search-history-item" style="display: flex; justify-content: space-between; align-items: center; height: 38px;">
                <a href="javascript:void(0)" onmousedown="applySearch('${kw}')" style="flex: 1; display: flex; align-items: center; height: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; font-size: 1.4rem;">${kw}</a>
                <span onmousedown="deleteFromHistory('${kw}', event)" style="cursor: pointer; padding: 0 10px; color: #ccc; font-size: 1.2rem; height: 100%; display: flex; align-items: center;"><i class="fa-solid fa-xmark"></i></span>
            </li>
        `).join("");
        let clearAllHtml = "";
        if (historyList.length > 2) {
            clearAllHtml = `<li class="header__search-history-item" onmousedown="deleteAllHistory(event)" style="text-align: center; color: #777; font-weight: 500; border-top: 1px solid #f1f1f1; justify-content: center; height: 38px; display: flex; align-items: center; font-size: 1.4rem;">Xóa tất cả lịch sử tìm kiếm</li>`;
        }
        historyContainer.innerHTML = `<h3 class="header__search-history-heading">Lịch sử tìm kiếm</h3><ul class="header__search-history-list" id="search-history-list">${listItemsHtml}${clearAllHtml}</ul>`;
    } else {
        historyContainer.innerHTML = `<div class="header__search-history-heading" style="text-align: center; margin-bottom: 12px;">Chưa có lịch sử</div>`;
    }
}

function addToHistory(keyword) {
    if(!keyword) return;
    let history = JSON.parse(localStorage.getItem("search_history")) || [];
    history = history.filter(k => k !== keyword);
    history.unshift(keyword);
    if(history.length > 5) history.pop(); 
    localStorage.setItem("search_history", JSON.stringify(history));
    renderSearchHistory();
}

window.applySearch = function(kw) {
    const searchInput = document.getElementById("search-input");
    if(searchInput) searchInput.value = kw;
    handleSearch();
}

window.deleteFromHistory = function(keyword, event) {
    event.stopPropagation(); event.preventDefault();
    let history = JSON.parse(localStorage.getItem("search_history")) || [];
    history = history.filter(k => k !== keyword);
    localStorage.setItem("search_history", JSON.stringify(history));
    renderSearchHistory();
    const searchInput = document.getElementById("search-input");
    if(searchInput) searchInput.focus();
}

window.deleteAllHistory = function(event) {
    event.stopPropagation(); event.preventDefault();
    if(confirm("Xóa toàn bộ lịch sử?")) {
        localStorage.removeItem("search_history");
        renderSearchHistory();
        const searchInput = document.getElementById("search-input");
        if(searchInput) searchInput.focus();
    }
}

// ---------------------------------------------------------
// [QUAN TRỌNG] XỬ LÝ HEADER USER (Avatar & Tên)
// ---------------------------------------------------------
function checkLoginStatus() {
    const user = JSON.parse(localStorage.getItem('user_login'));
    
    // Tìm thẻ ul user-menu trong header
    // Lưu ý: class header__navbar-list:last-child là nơi chứa menu user
    const navbarList = document.querySelector('.header__navbar-list:last-child'); 
    
    if (user && navbarList) {
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
        // Nếu chưa đăng nhập
        navbarList.innerHTML = `
            <li class="header__navbar-item header__navbar-item--separate"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-bell"></i> Thông báo</a></li>
            <li class="header__navbar-item"><a href="" class="header__navbar-item-link"><i class="header__navbar-icon fa-regular fa-circle-question"></i> Trợ giúp</a></li>
            <li class="header__navbar-item header__navbar-item--strong header__navbar-item--separate" id="register-btn">Đăng ký</li>
            <li class="header__navbar-item header__navbar-item--strong" id="login-btn">Đăng nhập</li>
        `;
    }
}

window.logout = function() { 
    if(confirm("Đăng xuất?")) { 
        localStorage.removeItem('user_login'); 
        localStorage.removeItem('checkout_items'); 
        window.location.href = "index.html"; 
    } 
}

// ... (Giữ nguyên các hàm auth handleRegister, handleLogin, openModal, closeModal...) ...

function handleRegister() {
    const inputs = document.querySelectorAll('#register-form .auth-form__input');
    const email = inputs[0].value.trim(); const password = inputs[1].value.trim(); const rePass = inputs[2].value.trim();
    if (!email || !password || !rePass) return alert("Thiếu thông tin!");
    if (password !== rePass) return alert("Mật khẩu không khớp!");
    
    fetch(`${apiUrl}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: email.split('@')[0], email, password }) })
    .then(r => r.json()).then(d => { alert(d.message); if(d.message.includes("thành công")) openModal("login"); })
    .catch(() => alert("Lỗi server"));
}

function handleLogin() {
    const inputs = document.querySelectorAll('#login-form .auth-form__input');
    fetch(`${apiUrl}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inputs[0].value.trim(), password: inputs[1].value.trim() }) })
    .then(r => r.json()).then(d => {
        if(d.user) {
            alert("Đăng nhập thành công!"); 
            localStorage.setItem('user_login', JSON.stringify(d.user));
            d.user.role === 1 ? window.location.href = 'admin.html' : window.location.reload();
        } else alert(d.message);
    }).catch(() => alert("Lỗi server"));
}

function handleAdminLogin() {
    fetch(`${apiUrl}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById("admin-email").value.trim(), password: document.getElementById("admin-password").value.trim() }) })
    .then(r => r.json()).then(d => {
        if(d.user && d.user.role === 1) { localStorage.setItem('user_login', JSON.stringify(d.user)); window.location.href = 'admin.html'; }
        else alert("Không có quyền truy cập!");
    });
}

function openModal(type) {
    const modal = document.querySelector(".modal");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const adminLoginForm = document.getElementById("admin-login-form");

    if (modal) modal.style.display = "flex";
    if (registerForm) registerForm.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (adminLoginForm) adminLoginForm.style.display = "none";

    if (type === "register" && registerForm) registerForm.style.display = "block";
    if (type === "login" && loginForm) loginForm.style.display = "block";
    if (type === "admin" && adminLoginForm) adminLoginForm.style.display = "block";
}

function closeModal() {
    const modal = document.querySelector(".modal");
    if (modal) modal.style.display = "none";
}

function renderCartHeader() {
    const user = JSON.parse(localStorage.getItem('user_login'));
    const cartList = document.querySelector(".header__cart-list");
    const cartNotice = document.querySelector(".header__cart-notice");
    if (!user) { if (cartNotice) cartNotice.innerText = "0"; return; }

    fetch(`${apiUrl}/cart/${user.id}`).then(r => r.json()).then(cart => {
        if (cartNotice) cartNotice.innerText = cart.length;
        if (!cartList) return;
        if (cart.length === 0) {
            cartList.classList.add("header__cart-list--no-cart");
            cartList.innerHTML = `<img src="./assets/img/no_cart.png" class="header__cart-no-cart-img"><span class="header__cart-list--no-cart-msg">Giỏ hàng trống</span>`;
        } else {
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
    }).catch(e => console.log(e));
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", {style: 'currency', currency: 'VND'}).format(amount);
}