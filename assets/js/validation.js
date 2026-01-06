/* =========================================================
   TWIN SHOP - VALIDATION.JS
   =========================================================
   
   File này chứa các HÀM KIỂM TRA DỮ LIỆU (Validation):
   
   1. PATTERNS (Regex)
      - Các biểu thức chính quy để kiểm tra format
      - VD: email phải có @, phone 10 số...
   
   2. VALIDATE FUNCTIONS
      - validateEmail(), validatePhone(), validatePassword()...
      - Trả về { isValid: true/false, message: 'Lỗi...' }
   
   3. UI HELPER FUNCTIONS
      - showError(): Hiện thông báo lỗi dưới input
      - clearError(): Xóa thông báo lỗi
      - showSuccess(): Viền xanh khi hợp lệ
   
   4. UTILITY FUNCTIONS
      - safeJSONParse(): Parse JSON an toàn
      - showToast(): Hiện thông báo toast
   
   ========================================================= */

// Bắt lỗi JSON parse từ browser extension (tránh log lỗi không cần thiết)
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('is not valid JSON')) {
        event.preventDefault();
        console.warn('Suppressed JSON parse error (likely from browser extension)');
    }
});

/* =========================================================
   VALIDATOR OBJECT - Chứa tất cả logic validation
   ========================================================= */
const Validator = {
    
    /* ---------------------------------------------------------
       PATTERNS - Biểu thức chính quy (Regular Expression/Regex)
       ---------------------------------------------------------
       
       Regex là cách kiểm tra xem chuỗi có khớp với mẫu không.
       
       Cú pháp cơ bản:
       - ^     : Bắt đầu chuỗi
       - $     : Kết thúc chuỗi
       - [abc] : Một trong các ký tự a, b, c
       - [0-9] : Một chữ số từ 0-9
       - {n,m} : Lặp lại từ n đến m lần
       - +     : Lặp lại 1 hoặc nhiều lần
       - *     : Lặp lại 0 hoặc nhiều lần
       - ?     : 0 hoặc 1 lần (tùy chọn)
       - (?=..): Lookahead - kiểm tra có chứa ... không
       --------------------------------------------------------- */
    patterns: {
        // Email: 
        // [a-zA-Z0-9._%+-]+ : Phần trước @, gồm chữ/số và ._%+-
        // @                  : Bắt buộc có @
        // [a-zA-Z0-9.-]+     : Tên domain (gmail, yahoo...)
        // \\.                : Dấu chấm
        // [a-zA-Z]{2,}       : Đuôi domain (com, vn...) ít nhất 2 ký tự
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        
        // Số điện thoại Việt Nam:
        // ^0              : Bắt đầu bằng 0
        // [3|5|7|8|9]     : Số thứ 2 là 3, 5, 7, 8 hoặc 9 (đầu số mới)
        // [0-9]{8}$       : Tiếp theo 8 chữ số -> Tổng 10 số
        phone: /^(0[3|5|7|8|9])[0-9]{8}$/,
        
        // Password:
        // (?=.*[A-Za-z])  : Phải có ít nhất 1 chữ cái
        // (?=.*\\d)        : Phải có ít nhất 1 chữ số
        // [A-Za-z\\d@$!%*#?&]{6,} : Gồm chữ/số/ký tự đặc biệt, ít nhất 6 ký tự
        password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/,
        
        // Tên: Chỉ chữ cái (bao gồm tiếng Việt) và khoảng trắng
        // À-ỹ : Các ký tự có dấu tiếng Việt
        // {2,50} : Từ 2 đến 50 ký tự
        fullName: /^[a-zA-ZÀ-ỹ\s]{2,50}$/,
        
        // Giá tiền: Số dương, bắt đầu từ 1
        price: /^[1-9]\d*$/,
        
        // Số lượng: Số nguyên dương
        quantity: /^[1-9]\d*$/
    },

    /* =========================================================
       VALIDATION FUNCTIONS - Các hàm kiểm tra
       =========================================================
       
       Tất cả đều trả về object:
       { 
         isValid: true/false,    // Hợp lệ hay không
         message: 'Lỗi...'       // Thông báo lỗi (nếu có)
       }
       ========================================================= */
    
    /**
     * Kiểm tra Email
     * @param {string} email - Email cần kiểm tra
     * @returns {object} { isValid: boolean, message: string }
     * 
     * Ví dụ:
     * validateEmail('test@gmail.com') -> { isValid: true, message: '' }
     * validateEmail('invalid')        -> { isValid: false, message: 'Email không hợp lệ!' }
     */
    validateEmail(email) {
        // Kiểm tra rỗng
        if (!email || email.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập email!' };
        }
        // Kiểm tra format bằng regex
        if (!this.patterns.email.test(email.trim())) {
            return { isValid: false, message: 'Email không hợp lệ! (VD: example@gmail.com)' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Kiểm tra Số điện thoại Việt Nam
     * @param {string} phone - SĐT cần kiểm tra
     * @returns {object} { isValid: boolean, message: string }
     * 
     * Ví dụ:
     * validatePhone('0912345678') -> { isValid: true }
     * validatePhone('0123456789') -> { isValid: false } (đầu 012 không hợp lệ)
     */
    validatePhone(phone) {
        if (!phone || phone.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập số điện thoại!' };
        }
        // Loại bỏ khoảng trắng và dấu gạch ngang
        const cleanPhone = phone.replace(/[\s-]/g, '');
        if (!this.patterns.phone.test(cleanPhone)) {
            return { isValid: false, message: 'SĐT không hợp lệ! (10 số, bắt đầu 03/05/07/08/09)' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Kiểm tra Mật khẩu
     * Yêu cầu: Ít nhất 6 ký tự, có cả chữ và số
     * 
     * @param {string} password 
     * @returns {object} { isValid: boolean, message: string }
     */
    validatePassword(password) {
        if (!password || password === '') {
            return { isValid: false, message: 'Vui lòng nhập mật khẩu!' };
        }
        if (password.length < 6) {
            return { isValid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự!' };
        }
        if (!this.patterns.password.test(password)) {
            return { isValid: false, message: 'Mật khẩu phải có cả chữ và số!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Kiểm tra Xác nhận mật khẩu
     * So sánh với mật khẩu gốc
     * 
     * @param {string} password - Mật khẩu gốc
     * @param {string} confirmPassword - Mật khẩu xác nhận
     * @returns {object} { isValid: boolean, message: string }
     */
    validateConfirmPassword(password, confirmPassword) {
        if (!confirmPassword || confirmPassword === '') {
            return { isValid: false, message: 'Vui lòng xác nhận mật khẩu!' };
        }
        if (password !== confirmPassword) {
            return { isValid: false, message: 'Mật khẩu xác nhận không khớp!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Kiểm tra Họ tên
     * @param {string} name 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateFullName(name) {
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập họ tên!' };
        }
        if (name.trim().length < 2) {
            return { isValid: false, message: 'Họ tên phải có ít nhất 2 ký tự!' };
        }
        if (name.trim().length > 50) {
            return { isValid: false, message: 'Họ tên không quá 50 ký tự!' };
        }
        // Cho phép chữ cái tiếng Việt và khoảng trắng
        const namePattern = /^[a-zA-ZÀ-ỹ\s]+$/;
        if (!namePattern.test(name.trim())) {
            return { isValid: false, message: 'Họ tên chỉ được chứa chữ cái!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Địa chỉ
     * @param {string} address 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateAddress(address) {
        if (!address || address.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập địa chỉ!' };
        }
        if (address.trim().length < 10) {
            return { isValid: false, message: 'Địa chỉ phải có ít nhất 10 ký tự!' };
        }
        if (address.trim().length > 200) {
            return { isValid: false, message: 'Địa chỉ không quá 200 ký tự!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Giá tiền
     * @param {string|number} price 
     * @returns {object} { isValid: boolean, message: string }
     */
    validatePrice(price) {
        if (!price || price === '') {
            return { isValid: false, message: 'Vui lòng nhập giá!' };
        }
        const numPrice = Number(price);
        if (isNaN(numPrice) || numPrice <= 0) {
            return { isValid: false, message: 'Giá phải là số dương!' };
        }
        if (numPrice > 999999999) {
            return { isValid: false, message: 'Giá không hợp lệ!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Số lượng
     * @param {string|number} quantity 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateQuantity(quantity) {
        if (!quantity || quantity === '') {
            return { isValid: false, message: 'Vui lòng nhập số lượng!' };
        }
        const num = Number(quantity);
        if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            return { isValid: false, message: 'Số lượng phải là số nguyên không âm!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Tên sản phẩm
     * @param {string} name 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateProductName(name) {
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập tên sản phẩm!' };
        }
        if (name.trim().length < 3) {
            return { isValid: false, message: 'Tên sản phẩm phải có ít nhất 3 ký tự!' };
        }
        if (name.trim().length > 255) {
            return { isValid: false, message: 'Tên sản phẩm không quá 255 ký tự!' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Ngày sinh
     * @param {number} day 
     * @param {number} month 
     * @param {number} year 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateBirthday(day, month, year) {
        if (!day || !month || !year || day == 0 || month == 0 || year == 0) {
            return { isValid: false, message: 'Vui lòng chọn ngày tháng năm sinh!' };
        }
        
        const date = new Date(year, month - 1, day);
        const today = new Date();
        
        // Kiểm tra ngày hợp lệ
        if (date.getDate() != day || date.getMonth() + 1 != month || date.getFullYear() != year) {
            return { isValid: false, message: 'Ngày sinh không hợp lệ!' };
        }
        
        // Kiểm tra không được sinh trong tương lai
        if (date > today) {
            return { isValid: false, message: 'Ngày sinh không thể trong tương lai!' };
        }
        
        // Kiểm tra tuổi (phải ít nhất 10 tuổi, không quá 120 tuổi)
        const age = today.getFullYear() - date.getFullYear();
        if (age < 10) {
            return { isValid: false, message: 'Bạn phải ít nhất 10 tuổi!' };
        }
        if (age > 120) {
            return { isValid: false, message: 'Ngày sinh không hợp lệ!' };
        }
        
        return { isValid: true, message: '' };
    },

    /* =========================================================
       UI HELPER FUNCTIONS - Hàm hỗ trợ giao diện
       =========================================================
       
       Dùng để hiển thị/xóa thông báo lỗi trên form
       ========================================================= */

    /**
     * Hiển thị lỗi dưới input
     * 
     * Tạo thẻ div.validation-error và chèn vào cuối wrapper
     * 
     * @param {HTMLElement} inputElement - Thẻ input bị lỗi
     * @param {string} message - Thông báo lỗi
     * 
     * Ví dụ:
     * Validator.showError(emailInput, 'Email không hợp lệ!')
     * -> Input có viền đỏ, hiện text lỗi bên dưới
     */
    showError(inputElement, message) {
        // Bỏ qua input search header (không cần hiện lỗi)
        if (inputElement.id === 'search-input') return;
        
        // Xóa error cũ nếu có (tránh trùng lặp)
        this.clearError(inputElement);
        
        // Thêm class error và viền đỏ cho input
        inputElement.classList.add('input-error');
        inputElement.style.borderColor = '#ee4d2d';  // Viền cam
        
        // Tìm wrapper (parent chứa input)
        // Hỗ trợ nhiều loại wrapper khác nhau
        let wrapper = inputElement.closest('.auth-form__input-wrap') 
                   || inputElement.closest('.modal-input-group') 
                   || inputElement.closest('.form-group');
        
        // Nếu không tìm thấy wrapper phù hợp, tạo wrapper tạm
        if (!wrapper) {
            // Chèn error sau input thay vì vào parent
            const errorDiv = document.createElement('div');
            errorDiv.className = 'validation-error';
            errorDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
            inputElement.insertAdjacentElement('afterend', errorDiv);
            return;
        }
        
        // Tạo thẻ hiển thị lỗi
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
        
        // Chèn vào cuối wrapper
        wrapper.appendChild(errorDiv);
    },

    /**
     * Xóa hiển thị lỗi khỏi input
     * Bỏ viền đỏ và xóa thẻ thông báo lỗi
     * 
     * @param {HTMLElement} inputElement 
     */
    clearError(inputElement) {
        // Bỏ qua input search header
        if (inputElement.id === 'search-input') return;
        
        // Xóa class và reset border
        inputElement.classList.remove('input-error');
        inputElement.style.borderColor = '';  // Reset về mặc định
        
        // Tìm wrapper
        let wrapper = inputElement.closest('.auth-form__input-wrap') 
                   || inputElement.closest('.modal-input-group') 
                   || inputElement.closest('.form-group');
        
        // Xóa thẻ error nếu có
        if (wrapper) {
            const errorDiv = wrapper.querySelector('.validation-error');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
        
        // Cũng xóa error nếu nằm ngay sau input (trường hợp không có wrapper)
        const nextEl = inputElement.nextElementSibling;
        if (nextEl && nextEl.classList.contains('validation-error')) {
            nextEl.remove();
        }
    },

    /**
     * Hiển thị trạng thái success (viền xanh)
     * Dùng khi input hợp lệ
     * 
     * @param {HTMLElement} inputElement 
     */
    showSuccess(inputElement) {
        this.clearError(inputElement);
        inputElement.style.borderColor = '#28a745';  // Viền xanh lá
    },

    /**
     * Validate một input và hiển thị lỗi
     * @param {HTMLElement} inputElement 
     * @param {string} type - Loại validate: 'email', 'phone', 'password', 'fullName', 'address', 'price', 'quantity', 'productName'
     * @param {object} options - Tùy chọn bổ sung (VD: { confirmPassword: '...' })
     * @returns {boolean}
     */
    validateInput(inputElement, type, options = {}) {
        const value = inputElement.value;
        let result;

        switch (type) {
            case 'email':
                result = this.validateEmail(value);
                break;
            case 'phone':
                result = this.validatePhone(value);
                break;
            case 'password':
                result = this.validatePassword(value);
                break;
            case 'confirmPassword':
                result = this.validateConfirmPassword(options.password, value);
                break;
            case 'fullName':
                result = this.validateFullName(value);
                break;
            case 'address':
                result = this.validateAddress(value);
                break;
            case 'price':
                result = this.validatePrice(value);
                break;
            case 'quantity':
                result = this.validateQuantity(value);
                break;
            case 'productName':
                result = this.validateProductName(value);
                break;
            default:
                result = { isValid: true, message: '' };
        }

        if (!result.isValid) {
            this.showError(inputElement, result.message);
        } else {
            this.showSuccess(inputElement);
        }

        return result.isValid;
    },

    /**
     * Validate form với nhiều input
     * @param {Array} validations - Mảng { input: HTMLElement, type: string, options?: object }
     * @returns {boolean}
     */
    validateForm(validations) {
        let isFormValid = true;

        validations.forEach(({ input, type, options }) => {
            const isValid = this.validateInput(input, type, options);
            if (!isValid) {
                isFormValid = false;
            }
        });

        return isFormValid;
    },

    /**
     * Thêm realtime validation khi blur (mất focus)
     * @param {HTMLElement} inputElement 
     * @param {string} type 
     * @param {object} options 
     */
    addBlurValidation(inputElement, type, options = {}) {
        inputElement.addEventListener('blur', () => {
            this.validateInput(inputElement, type, options);
        });

        // Xóa error khi focus lại
        inputElement.addEventListener('focus', () => {
            this.clearError(inputElement);
        });
    }
};

/* =========================================================
   UTILITY FUNCTIONS - Hàm tiện ích dùng chung
   ========================================================= */

/**
 * Safe JSON Parse - Parse JSON an toàn, tránh lỗi
 * 
 * JavaScript sẽ báo lỗi nếu JSON.parse("undefined") hoặc JSON.parse(null)
 * Hàm này xử lý các trường hợp đó
 * 
 * @param {string} str - Chuỗi JSON cần parse
 * @returns {any} - Object đã parse, hoặc null nếu lỗi
 * 
 * Ví dụ:
 * safeJSONParse('{"name":"John"}')  -> { name: 'John' }
 * safeJSONParse('undefined')        -> null (không báo lỗi)
 * safeJSONParse(null)               -> null (không báo lỗi)
 */
function safeJSONParse(str) {
    // Kiểm tra các giá trị không hợp lệ
    if (!str || str === "undefined" || str === "null") return null;
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn("JSON parse error:", e);
        return null;
    }
}

/* =========================================================
   TOAST NOTIFICATION - Thông báo dạng toast
   =========================================================
   
   Toast = Thông báo nhỏ xuất hiện góc màn hình, tự mất sau vài giây
   
   Các loại:
   - success: Màu xanh, icon check (thành công)
   - error: Màu đỏ, icon X (lỗi)
   - warning: Màu vàng, icon tam giác (cảnh báo)
   - info: Màu xanh dương, icon i (thông tin)
   ========================================================= */

/**
 * Hiển thị Toast Notification
 * 
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3000 = 3 giây
 * 
 * Ví dụ:
 * showToast('Đăng nhập thành công!', 'success');
 * showToast('Có lỗi xảy ra!', 'error', 5000);
 */
function showToast(message, type = 'success', duration = 3000) {
    // Tạo container nếu chưa có (chỉ tạo 1 lần)
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Tạo toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    // Icon theo loại toast
    const icons = {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-xmark"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>'
    };

    // Cấu trúc HTML của toast
    toast.innerHTML = `
        <div class="toast__icon">${icons[type] || icons.success}</div>
        <div class="toast__content">
            <p class="toast__message">${message}</p>
        </div>
        <div class="toast__close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </div>
    `;

    // Thêm toast vào container
    container.appendChild(toast);

    // Animation hiện (delay 10ms để CSS transition hoạt động)
    setTimeout(() => toast.classList.add('toast--show'), 10);

    // Tự động ẩn và xóa sau duration
    setTimeout(() => {
        toast.classList.remove('toast--show');
        toast.classList.add('toast--hide');
        // Xóa khỏi DOM sau khi animation ẩn xong (300ms)
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export cho Node.js module (nếu dùng)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, safeJSONParse };
}
