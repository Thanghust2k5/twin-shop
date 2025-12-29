// Suppress uncaught JSON parse errors from browser extensions
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('is not valid JSON')) {
        event.preventDefault();
        console.warn('Suppressed JSON parse error (likely from browser extension)');
    }
});

const Validator = {
    patterns: {
        // Email: phải có @ và domain hợp lệ
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        
        // Số điện thoại Việt Nam: 10 số, bắt đầu 0
        phone: /^(0[3|5|7|8|9])[0-9]{8}$/,
        
        // Password: ít nhất 6 ký tự, có chữ và số
        password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/,
        
        // Tên: chỉ chữ cái và khoảng trắng, 2-50 ký tự
        fullName: /^[a-zA-ZÀ-ỹ\s]{2,50}$/,
        
        // Giá tiền: số dương
        price: /^[1-9]\d*$/,
        
        // Số lượng: số nguyên dương
        quantity: /^[1-9]\d*$/
    },

    // ========== VALIDATION FUNCTIONS ==========
    
    /**
     * Validate Email
     * @param {string} email 
     * @returns {object} { isValid: boolean, message: string }
     */
    validateEmail(email) {
        if (!email || email.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập email!' };
        }
        if (!this.patterns.email.test(email.trim())) {
            return { isValid: false, message: 'Email không hợp lệ! (VD: example@gmail.com)' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Số điện thoại Việt Nam
     * @param {string} phone 
     * @returns {object} { isValid: boolean, message: string }
     */
    validatePhone(phone) {
        if (!phone || phone.trim() === '') {
            return { isValid: false, message: 'Vui lòng nhập số điện thoại!' };
        }
        // Loại bỏ khoảng trắng và dấu -
        const cleanPhone = phone.replace(/[\s-]/g, '');
        if (!this.patterns.phone.test(cleanPhone)) {
            return { isValid: false, message: 'SĐT không hợp lệ! (10 số, bắt đầu 03/05/07/08/09)' };
        }
        return { isValid: true, message: '' };
    },

    /**
     * Validate Password
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
     * Validate Confirm Password
     * @param {string} password 
     * @param {string} confirmPassword 
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
     * Validate Họ tên
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

    // ========== UI HELPER FUNCTIONS ==========

    /**
     * Hiển thị lỗi dưới input
     * @param {HTMLElement} inputElement 
     * @param {string} message 
     */
    showError(inputElement, message) {
        // Bỏ qua input search header
        if (inputElement.id === 'search-input') return;
        
        // Xóa error cũ nếu có
        this.clearError(inputElement);
        
        // Thêm class error cho input
        inputElement.classList.add('input-error');
        inputElement.style.borderColor = '#ee4d2d';
        
        // Tìm wrapper (hỗ trợ nhiều loại wrapper, KHÔNG lấy header__search-input-wrap)
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
     * Xóa hiển thị lỗi
     * @param {HTMLElement} inputElement 
     */
    clearError(inputElement) {
        // Bỏ qua input search header
        if (inputElement.id === 'search-input') return;
        
        inputElement.classList.remove('input-error');
        inputElement.style.borderColor = '';
        
        // Tìm wrapper
        let wrapper = inputElement.closest('.auth-form__input-wrap') 
                   || inputElement.closest('.modal-input-group') 
                   || inputElement.closest('.form-group');
        
        if (wrapper) {
            const errorDiv = wrapper.querySelector('.validation-error');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
        
        // Cũng xóa error nếu nằm ngay sau input
        const nextEl = inputElement.nextElementSibling;
        if (nextEl && nextEl.classList.contains('validation-error')) {
            nextEl.remove();
        }
    },

    /**
     * Hiển thị success cho input
     * @param {HTMLElement} inputElement 
     */
    showSuccess(inputElement) {
        this.clearError(inputElement);
        inputElement.style.borderColor = '#28a745';
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

// ========== UTILITY FUNCTIONS ==========

/**
 * Safe JSON Parse - Tránh lỗi "undefined" is not valid JSON
 * @param {string} str 
 * @returns {any}
 */
function safeJSONParse(str) {
    if (!str || str === "undefined" || str === "null") return null;
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn("JSON parse error:", e);
        return null;
    }
}

// ========== TOAST NOTIFICATION ==========

/**
 * Hiển thị Toast Notification
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Thời gian hiển thị (ms), mặc định 3000
 */
function showToast(message, type = 'success', duration = 3000) {
    // Tạo container nếu chưa có
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Tạo toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    // Icon theo loại
    const icons = {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-xmark"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>'
    };

    toast.innerHTML = `
        <div class="toast__icon">${icons[type] || icons.success}</div>
        <div class="toast__content">
            <p class="toast__message">${message}</p>
        </div>
        <div class="toast__close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </div>
    `;

    container.appendChild(toast);

    // Animation hiện
    setTimeout(() => toast.classList.add('toast--show'), 10);

    // Tự động ẩn và xóa
    setTimeout(() => {
        toast.classList.remove('toast--show');
        toast.classList.add('toast--hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export cho module (nếu dùng)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, safeJSONParse };
}
