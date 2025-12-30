// =========================================================
// TWIN SHOP - ADMIN CHAT
// Quản lý chat realtime phía Admin
// =========================================================

const AdminChat = {
    socket: null,
    sessions: new Map(),
    currentSessionId: null,
    isConnected: false,

    // Khởi tạo
    init() {
        this.connect();
    },

    // Kết nối Socket
    connect() {
        this.socket = io(window.location.origin);

        this.socket.on("connect", () => {
            this.isConnected = true;
            console.log("✅ Admin đã kết nối chat server");
            
            // Đăng ký là admin
            this.socket.emit("admin:join");
        });

        this.socket.on("disconnect", () => {
            this.isConnected = false;
            console.log("❌ Admin mất kết nối chat server");
        });

        // Nhận danh sách phiên chat
        this.socket.on("admin:sessions", (sessions) => {
            this.sessions.clear(); // Clear trước khi thêm mới
            sessions.forEach(s => {
                this.sessions.set(s.id, s);
            });
            this.renderSessionsList();
        });

        // Có phiên chat mới
        this.socket.on("admin:newSession", (session) => {
            // Kiểm tra nếu session đã tồn tại thì không thêm mới
            if (!this.sessions.has(session.id)) {
                this.sessions.set(session.id, session);
                this.renderSessionsList();
                this.showNotification("Có khách hàng mới cần hỗ trợ!");
                this.playSound();
            }
        });

        // Có khách cần hỗ trợ trực tiếp
        this.socket.on("admin:needSupport", (data) => {
            const session = this.sessions.get(data.sessionId);
            if (session) {
                session.status = "waiting";
                this.renderSessionsList();
                this.showNotification(`${session.user.name || 'Khách'} cần hỗ trợ trực tiếp!`);
                this.playSound();
            }
        });

        // Nhận tin nhắn mới
        this.socket.on("admin:message", (data) => {
            const session = this.sessions.get(data.sessionId);
            if (session) {
                session.messages.push(data.message);
                session.unread = (session.unread || 0) + 1;
                
                // Nếu đang xem session này, render tin nhắn
                if (this.currentSessionId === data.sessionId) {
                    this.appendMessage(data.message);
                    this.socket.emit("admin:read", data.sessionId);
                    session.unread = 0;
                }
                
                this.renderSessionsList();
                this.updateBadge();
            }
        });

        // Cập nhật trạng thái session
        this.socket.on("admin:sessionUpdate", (data) => {
            // Cập nhật hoặc thêm mới session
            if (this.sessions.has(data.id)) {
                const session = this.sessions.get(data.id);
                Object.assign(session, data);
            } else {
                this.sessions.set(data.id, data);
            }
            this.renderSessionsList();
            
            if (this.currentSessionId === data.id) {
                this.updateChatHeader(this.sessions.get(data.id));
            }
        });
    },

    // Render danh sách phiên chat
    renderSessionsList() {
        const container = document.getElementById("chat-sessions-list");
        if (!container) return;

        const sessionsArray = Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (sessionsArray.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    <i class="fa-regular fa-comments"></i>
                    <p>Chưa có cuộc trò chuyện nào</p>
                </div>
            `;
            document.getElementById("session-count").innerText = "0";
            return;
        }

        container.innerHTML = sessionsArray.map(s => {
            const lastMsg = s.messages[s.messages.length - 1];
            const lastMsgText = lastMsg ? lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? "..." : "") : "Chưa có tin nhắn";
            const time = lastMsg ? new Date(lastMsg.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
            
            let statusClass = "status-online";
            let statusText = "Trực tuyến";
            if (s.status === "disconnected") {
                statusClass = "status-offline";
                statusText = "Đã rời đi";
            } else if (s.status === "waiting") {
                statusClass = "status-waiting";
                statusText = "Cần hỗ trợ";
            }

            return `
                <div class="chat-session-item ${this.currentSessionId === s.id ? 'active' : ''} ${s.status === 'waiting' ? 'needs-support' : ''}" 
                     onclick="AdminChat.selectSession('${s.id}')">
                    <div class="session-avatar">
                        <i class="fa-solid fa-user"></i>
                        <span class="session-status-dot ${statusClass}"></span>
                    </div>
                    <div class="session-info">
                        <div class="session-name">${s.user.name || 'Khách'}</div>
                        <div class="session-last-msg">${lastMsgText}</div>
                    </div>
                    <div class="session-meta">
                        <div class="session-time">${time}</div>
                        ${s.unread > 0 ? `<div class="session-unread">${s.unread}</div>` : ''}
                    </div>
                </div>
            `;
        }).join("");

        document.getElementById("session-count").innerText = sessionsArray.length;
        this.updateBadge();
    },

    // Chọn session để chat
    selectSession(sessionId) {
        this.currentSessionId = sessionId;
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Đánh dấu đã đọc
        session.unread = 0;
        this.socket.emit("admin:read", sessionId);

        // Hiển thị khung chat
        document.querySelector(".chat-detail-placeholder").style.display = "none";
        document.getElementById("chat-detail-active").style.display = "flex";

        // Cập nhật header
        this.updateChatHeader(session);

        // Render messages
        const msgContainer = document.getElementById("admin-chat-messages");
        msgContainer.innerHTML = "";
        session.messages.forEach(msg => this.appendMessage(msg));

        // Focus input
        document.getElementById("admin-chat-input").focus();

        // Cập nhật danh sách
        this.renderSessionsList();
    },

    // Cập nhật header chat
    updateChatHeader(session) {
        document.getElementById("chat-user-name").innerText = session.user.name || "Khách hàng";
        
        const statusEl = document.getElementById("chat-user-status");
        if (session.status === "disconnected") {
            statusEl.innerHTML = '<span class="status-dot offline"></span> Đã rời đi';
        } else {
            statusEl.innerHTML = '<span class="status-dot online"></span> Đang trực tuyến';
        }
    },

    // Thêm tin nhắn vào khung chat
    appendMessage(msg) {
        const container = document.getElementById("admin-chat-messages");
        if (!container) return;

        const msgDiv = document.createElement("div");
        msgDiv.className = `admin-chat-message ${msg.sender}`;

        const time = new Date(msg.time).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
        });

        let senderName = "";
        let avatar = "";

        if (msg.sender === "customer") {
            senderName = "Khách hàng";
            avatar = '<i class="fa-solid fa-user"></i>';
        } else if (msg.sender === "bot") {
            senderName = "Bot";
            avatar = '<i class="fa-solid fa-robot"></i>';
        } else if (msg.sender === "admin") {
            senderName = "Bạn";
            avatar = '<i class="fa-solid fa-headset"></i>';
        }

        msgDiv.innerHTML = `
            <div class="msg-avatar">${avatar}</div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-sender">${senderName}</span>
                    <span class="msg-time">${time}</span>
                </div>
                <div class="msg-text">${msg.text.replace(/\n/g, "<br>")}</div>
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    // Admin gửi tin nhắn
    sendMessage() {
        const input = document.getElementById("admin-chat-input");
        const text = input.value.trim();

        if (!text || !this.currentSessionId || !this.isConnected) return;

        this.socket.emit("admin:message", {
            sessionId: this.currentSessionId,
            text: text
        });

        // Thêm tin nhắn vào màn hình ngay
        const session = this.sessions.get(this.currentSessionId);
        const adminMsg = {
            id: Date.now(),
            sender: "admin",
            text: text,
            time: new Date()
        };
        session.messages.push(adminMsg);
        this.appendMessage(adminMsg);

        input.value = "";
        input.focus();
    },

    // Cập nhật badge trên menu
    updateBadge() {
        let totalUnread = 0;
        this.sessions.forEach(s => {
            totalUnread += s.unread || 0;
        });

        const badge = document.getElementById("admin-chat-badge");
        if (badge) {
            if (totalUnread > 0) {
                badge.innerText = totalUnread;
                badge.style.display = "inline-flex";
            } else {
                badge.style.display = "none";
            }
        }
    },

    // Hiển thị thông báo
    showNotification(message) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Twin Shop", {
                body: message,
                icon: "/assets/img/logo_favicon.png"
            });
        }
    },

    // Phát âm thanh thông báo
    playSound() {
        try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleIX/");
            audio.volume = 0.3;
            audio.play().catch(() => {});
        } catch (e) {}
    }
};

// Khởi tạo khi trang load
document.addEventListener("DOMContentLoaded", () => {
    // Xin quyền thông báo
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
    
    AdminChat.init();
});
