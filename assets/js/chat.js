// =========================================================
// TWIN SHOP - CHAT WIDGET
// Chat tự động + Realtime với Admin
// 
// CHỨC NĂNG:
// 1. Tạo giao diện chat widget (nút nổi góc phải dưới)
// 2. Kết nối Socket.io để chat realtime
// 3. Gửi/Nhận tin nhắn với server
// 4. Hiển thị badge thông báo khi có tin mới
//
// FLOW:
// - User click nút chat -> Mở box chat
// - Kết nối socket, gửi event "customer:start"
// - Server trả về tin nhắn qua event "chat:message"
// =========================================================

const ChatWidget = {
    socket: null,           // Socket.io instance
    isOpen: false,          // Trạng thái đóng/mở chat box
    isConnected: false,     // Đã kết nối socket chưa
    user: null,             // Thông tin user (id, name)
    initialized: false,     // Đã khởi tạo widget chưa

    // Khởi tạo chat widget
    // Chỉ chạy 1 lần, tạo giao diện và gắn sự kiện
    init() {
        // Kiểm tra để không khởi tạo 2 lần
        if (this.initialized || document.getElementById("chat-widget")) return;
        this.initialized = true;
        
        this.createWidget();   // Tạo HTML cho chat widget
        this.bindEvents();     // Gắn event click
        this.loadUser();       // Lấy thông tin user đăng nhập
    },

    // Lấy thông tin user từ localStorage
    // Nếu đã đăng nhập: Lấy id và full_name
    // Nếu chưa: Đặt tên là "Khách"
    loadUser() {
        const userStr = localStorage.getItem("user_login");
        if (userStr && userStr !== "undefined") {
            try {
                const parsed = JSON.parse(userStr);
                // Lấy full_name từ user object để hiển thị đúng tên
                this.user = {
                    id: parsed.id,
                    name: parsed.full_name || parsed.name || "Khách"
                };
            } catch (e) {
                this.user = { name: "Khách", id: null };
            }
        } else {
            this.user = { name: "Khách", id: null };
        }
    },

    // Tạo giao diện chat widget
    createWidget() {
        const html = `
            <!-- Nút mở chat -->
            <div id="chat-toggle" class="chat-toggle">
                <i class="fa-solid fa-comments"></i>
                <span class="chat-toggle-badge" style="display:none">0</span>
            </div>

            <!-- Khung chat -->
            <div id="chat-box" class="chat-box">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <img src="/assets/img/logo_favicon.png" class="chat-header-avatar" onerror="this.src='https://via.placeholder.com/40'" />
                        <div>
                            <div class="chat-header-name">Twin Shop</div>
                            <div class="chat-header-status">
                                <span class="status-dot"></span>
                                <span id="chat-status-text">Đang kết nối...</span>
                            </div>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <i class="fa-solid fa-minus" onclick="ChatWidget.minimize()"></i>
                        <i class="fa-solid fa-xmark" onclick="ChatWidget.close()"></i>
                    </div>
                </div>

                <div class="chat-messages" id="chat-messages">
                    <!-- Tin nhắn sẽ được thêm vào đây -->
                </div>

                <div class="chat-input-area">
                    <input type="text" id="chat-input" class="chat-input" 
                           placeholder="Nhập tin nhắn..." 
                           onkeypress="if(event.key==='Enter') ChatWidget.sendMessage()" />
                    <button class="chat-send-btn" onclick="ChatWidget.sendMessage()">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        const container = document.createElement("div");
        container.id = "chat-widget";
        container.innerHTML = html;
        document.body.appendChild(container);
    },

    // Gắn sự kiện
    bindEvents() {
        document.getElementById("chat-toggle").addEventListener("click", () => {
            this.open();
        });
    },

    // Kết nối Socket
    connect() {
        if (this.socket && this.isConnected) return;

        // Kết nối tới server
        this.socket = io(window.location.origin);

        this.socket.on("connect", () => {
            this.isConnected = true;
            document.getElementById("chat-status-text").innerText = "Trực tuyến";
            document.querySelector(".status-dot").classList.add("online");

            // Bắt đầu phiên chat
            this.socket.emit("customer:start", {
                user: this.user
            });
        });

        this.socket.on("disconnect", () => {
            this.isConnected = false;
            document.getElementById("chat-status-text").innerText = "Mất kết nối";
            document.querySelector(".status-dot").classList.remove("online");
        });

        // Nhận tin nhắn
        this.socket.on("chat:message", (msg) => {
            this.appendMessage(msg);
            
            // Nếu chat đang đóng, hiện badge
            if (!this.isOpen && msg.sender !== "customer") {
                this.showBadge();
            }
        });
    },

    // Mở chat
    open() {
        if (!this.isConnected) {
            this.connect();
        }
        
        this.isOpen = true;
        document.getElementById("chat-box").classList.add("open");
        document.getElementById("chat-toggle").classList.add("hidden");
        this.hideBadge();
        
        // Focus vào input
        setTimeout(() => {
            document.getElementById("chat-input").focus();
        }, 300);
    },

    // Đóng chat
    close() {
        this.isOpen = false;
        document.getElementById("chat-box").classList.remove("open");
        document.getElementById("chat-toggle").classList.remove("hidden");
    },

    // Thu nhỏ
    minimize() {
        this.close();
    },

    // Gửi tin nhắn
    sendMessage() {
        const input = document.getElementById("chat-input");
        const text = input.value.trim();
        
        if (!text || !this.isConnected) return;

        this.socket.emit("customer:message", { text });
        input.value = "";
    },

    // Thêm tin nhắn vào khung chat
    appendMessage(msg) {
        const container = document.getElementById("chat-messages");
        
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-message ${msg.sender}`;
        
        const time = new Date(msg.time).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
        });

        let senderName = "";
        let avatar = "";
        
        if (msg.sender === "bot") {
            senderName = "Trợ lý ảo";
            avatar = '<i class="fa-solid fa-robot"></i>';
        } else if (msg.sender === "admin") {
            senderName = "Nhân viên";
            avatar = '<i class="fa-solid fa-headset"></i>';
        }

        if (msg.sender === "customer") {
            msgDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${this.formatText(msg.text)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-sender">${senderName}</div>
                    <div class="message-text">${this.formatText(msg.text)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    // Format text (xuống dòng)
    formatText(text) {
        return text.replace(/\n/g, "<br>");
    },

    // Hiện badge thông báo
    showBadge() {
        const badge = document.querySelector(".chat-toggle-badge");
        let count = parseInt(badge.innerText) || 0;
        count++;
        badge.innerText = count;
        badge.style.display = "flex";
    },

    // Ẩn badge
    hideBadge() {
        const badge = document.querySelector(".chat-toggle-badge");
        badge.innerText = "0";
        badge.style.display = "none";
    }
};

// Khởi tạo khi trang load xong
document.addEventListener("DOMContentLoaded", () => {
    // Chỉ load chat widget ở trang khách (không phải admin)
    if (!window.location.pathname.includes("admin")) {
        ChatWidget.init();
    }
});
