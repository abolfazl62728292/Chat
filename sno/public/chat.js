// SNO Chat Application JavaScript

class SNOChat {
    constructor() {
        this.currentSessionId = null;
        this.sessions = [];
        this.userCredits = 0;
        this.messageRenderer = null;
        this.currentMessages = []; // برای ذخیره پیام‌های session جاری
        this.maxMessagesPerSession = 13; // حداکثر ۱۳ پیام در هر session
        this.init();
    }

    async init() {
        try {
            // راه‌اندازی MessageRenderer
            this.messageRenderer = new MessageRenderer();
            
            this.bindEvents();
            await this.loadUserData();
            await this.loadSessions();
            this.setupAutoResize();
        } catch (error) {
            console.error('خطا در راه‌اندازی اپلیکیشن:', error);
            // Show user-friendly error message
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 10px; border-radius: 5px; z-index: 1000;';
            errorDiv.textContent = 'خطا در بارگیری اپلیکیشن. لطفاً صفحه را تازه‌سازی کنید.';
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        }
    }

    bindEvents() {
        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        document.getElementById('overlay').addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // New chat button
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.createNewSession();
        });

        // Send message
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Remove Enter key to send message functionality
        // Messages can only be sent with the send button

        // Attach image button
        document.getElementById('attachBtn').addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });

        // Image input change
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        // Remove image button
        document.getElementById('removeImageBtn').addEventListener('click', () => {
            this.clearImagePreview();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.showLogoutModal();
        });

        // Delete modal events
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDeleteSession();
        });

        // Logout modal events
        document.getElementById('cancelLogoutBtn').addEventListener('click', () => {
            this.hideLogoutModal();
        });

        document.getElementById('confirmLogoutBtn').addEventListener('click', () => {
            this.confirmLogout();
        });

        // Close modals on overlay click
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.hideDeleteModal();
            }
        });

        document.getElementById('logoutModal').addEventListener('click', (e) => {
            if (e.target.id === 'logoutModal') {
                this.hideLogoutModal();
            }
        });

        // Image modal events
        const imageModal = document.getElementById('imageModal');
        if (imageModal) {
            imageModal.addEventListener('click', (e) => {
                if (e.target.id === 'imageModal' || e.target.id === 'closeImageModal') {
                    this.closeImageModal();
                }
            });
        }

        // Close modals with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideDeleteModal();
                this.hideLogoutModal();
                this.closeImageModal();
            }
        });
    }

    setupAutoResize() {
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/sno/user-credits');
            const data = await response.json();

            if (data.success) {
                document.getElementById('userName').textContent = 'کاربر';
                this.userCredits = data.credits.sno || 0;
                this.updateCreditsDisplay();
            }
        } catch (error) {
            console.error('خطا در بارگیری اطلاعات کاربر:', error);
            // Set fallback values
            document.getElementById('userName').textContent = 'کاربر';
            this.userCredits = 0;
            this.updateCreditsDisplay();
            this.showErrorMessage('خطا در بارگیری اطلاعات کاربر');
        }
    }

    async loadSessions() {
        try {
            const response = await fetch('/api/sno/sessions');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.sessions = data.sessions || [];
                this.renderSessions();

                // If no active session and sessions exist, select the first one
                if (!this.currentSessionId && this.sessions.length > 0) {
                    try {
                        await this.selectSession(this.sessions[0].id);
                    } catch (error) {
                        console.error('Error selecting first session:', error);
                        // Fallback: just show empty chat instead of breaking
                        this.clearMessages();
                    }
                }
            } else {
                console.warn('Failed to load sessions:', data.message);
                this.sessions = [];
                this.renderSessions();
            }
        } catch (error) {
            console.error('خطا در بارگیری جلسات:', error);
            this.sessions = [];
            this.renderSessions();

            // Only show error if it's not a simple network issue on page load
            if (!error.message.includes('Failed to fetch')) {
                this.showErrorMessage('خطا در بارگیری جلسات چت');
            }
        }
    }

    renderSessions() {
        const sessionsList = document.getElementById('sessionsList');

        if (this.sessions.length === 0) {
            sessionsList.innerHTML = '<div style="text-align: center; opacity: 0.6; padding: 20px;">هنوز چت جدیدی ایجاد نکرده‌اید</div>';
            return;
        }

        sessionsList.innerHTML = this.sessions.map(session => `
            <div class="session-item ${session.id === this.currentSessionId ? 'active' : ''}" 
                 onclick="snoChat.selectSession(${session.id})">
                <div class="session-title">${this.escapeHtml(session.title)}</div>
                <div class="delete-session" onclick="event.stopPropagation(); snoChat.deleteSession(${session.id})">
                    <i class="fas fa-trash"></i>
                </div>
            </div>
        `).join('');
    }

    async createNewSession() {
        // Simply clear current session and let user start typing
        this.currentSessionId = null;
        this.currentMessages = []; // ریست کردن شمارنده پیام‌ها
        this.clearMessages();
        this.hideMessageLimitReached(); // مخفی کردن پیام محدودیت هنگام ساخت چت جدید
        this.closeMobileMenu();

        // Focus on input for better UX
        const messageInput = document.getElementById('messageInput');
        messageInput.focus();
        messageInput.placeholder = 'پیام خود را بنویسید...';
    }

    async deleteSession(sessionId) {
        this.pendingDeleteSessionId = sessionId;
        this.showDeleteModal();
    }

    showDeleteModal() {
        document.getElementById('deleteModal').style.display = 'flex';
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.pendingDeleteSessionId = null;
    }

    async confirmDeleteSession() {
        if (!this.pendingDeleteSessionId) return;

        const sessionId = this.pendingDeleteSessionId;
        this.hideDeleteModal();

        try {
            const response = await fetch(`/api/sno/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                if (this.currentSessionId === sessionId) {
                    this.currentSessionId = null;
                    this.clearMessages();
                }
                await this.loadSessions();
                this.showSuccessMessage('چت با موفقیت حذف شد');
            } else {
                this.showErrorMessage(data.message || 'خطا در حذف چت');
            }
        } catch (error) {
            console.error('خطا در حذف چت:', error);
            this.showErrorMessage('خطا در حذف چت');
        }
    }

    async selectSession(sessionId) {
        try {
            this.currentSessionId = sessionId;
            this.renderSessions();

            // مخفی کردن پیام محدودیت قبل از بارگذاری session جدید
            this.hideMessageLimitReached();

            await this.loadMessages();

            this.closeMobileMenu();

            // Update chat title
            const session = this.sessions.find(s => s.id === sessionId);
            if (session) {
                // Keep title as SnoChat - document.getElementById('chatTitle').textContent = session.title;
            }
        } catch (error) {
            console.error('خطا در انتخاب جلسه چت:', error);
            // Show error but don't break the UI
            this.showErrorMessage('خطا در بارگیری چت. لطفاً دوباره تلاش کنید.');
        }
    }

    async loadMessages() {
        if (!this.currentSessionId) {
            this.clearMessages();
            return;
        }

        try {
            const response = await fetch(`/api/sno/sessions/${this.currentSessionId}/messages`);

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('دسترسی غیرمجاز');
                } else if (response.status >= 500) {
                    throw new Error('خطا در سرور. لطفاً دوباره تلاش کنید.');
                } else {
                    throw new Error(`خطای HTTP ${response.status}`);
                }
            }

            const data = await response.json();

            if (data.success) {
                await this.renderMessages(data.messages || []);
            } else {
                console.warn('Failed to load messages:', data.message);
                this.showErrorMessage(data.message || 'خطا در بارگیری پیام‌ها');
                this.clearMessages();
            }
        } catch (error) {
            console.error('خطا در بارگیری پیام‌ها:', error);
            this.showErrorMessage('خطا در بارگیری پیام‌ها. اتصال اینترنت خود را بررسی کنید.');
        }
    }

    async renderMessages(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        const emptyChat = document.getElementById('emptyChat');

        try {
            if (!messagesContainer || !emptyChat) {
                console.error('عناصر ضروری رابط کاربری یافت نشد');
                return;
            }

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                this.currentMessages = []; // ریست کردن پیام‌های جاری
                if (emptyChat) {
                    emptyChat.style.display = 'flex';
                }
                this.checkMessageLimit(); // بررسی محدودیت
                return;
            }

            if (emptyChat) {
                emptyChat.style.display = 'none';
            }

            // Clear existing messages safely
            const typingIndicator = document.getElementById('typingIndicator');
            if (!typingIndicator) {
                console.error('Typing indicator not found');
                return;
            }

            // Remove all children except typing indicator
            const children = Array.from(messagesContainer.children);
            children.forEach(child => {
                if (child.id !== 'typingIndicator' && child.id !== 'emptyChat') {
                    try {
                        messagesContainer.removeChild(child);
                    } catch (e) {
                        console.warn('خطا در حذف عنصر:', e);
                    }
                }
            });

            // مرتب‌سازی پیام‌ها بر اساس زمان ایجاد (قدیمی به جدید)
            messages.sort((a, b) => {
                const timeA = a.created_at ? new Date(a.created_at * 1000) : new Date(0);
                const timeB = b.created_at ? new Date(b.created_at * 1000) : new Date(0);
                return timeA - timeB;
            });

            // Safely render each message
            for (let index = 0; index < messages.length; index++) {
                const message = messages[index];
                try {
                    if (message && 
                        typeof message === 'object' && 
                        message.sender_type && 
                        typeof message.sender_type === 'string' &&
                        message.content !== undefined && 
                        message.content !== null&&
                        message.content !== '') {

                        let timestamp = new Date();
                        if (message.created_at) {
                            const parsedTime = new Date(message.created_at * 1000);
                            if (!isNaN(parsedTime.getTime())) {
                                timestamp = parsedTime;
                            }
                        }

                        // اگر پیام عکس دارد، مسیر عکس را برای نمایش آماده کن
                        let imageUrl = null;
                        if (message.image_path && message.sender_type === 'user') {
                            // مسیر image_path قبلاً storage/uploads/... هست، پس فقط / اضافه میکنیم
                            imageUrl = message.image_path.startsWith('/') ? message.image_path : `/${message.image_path}`;
                        }

                        await this.addMessageToDOM(message.sender_type, message.content, timestamp, true, imageUrl);
                    } else {
                        console.warn(`Invalid message at index ${index}:`, message);
                    }
                } catch (msgError) {
                    console.error(`Error rendering message at index ${index}:`, msgError, message);
                }
            }

            // بروزرسانی پیام‌های جاری برای محدودیت
            this.currentMessages = messages || [];
            
            // بررسی محدودیت پیام
            this.checkMessageLimit();

            // برای پیام‌های تاریخی، بعد از رندر کامل، به آخرین پیام اسکرول کن (بدون انیمیشن)
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });

        } catch (error) {
            console.error('خطا در نمایش پیام‌ها:', error);
            // Fallback: show empty chat
            if (emptyChat) {
                emptyChat.style.display = 'flex';
            }
            this.showErrorMessage('خطا در نمایش پیام‌ها. لطفاً صفحه را تازه‌سازی کنید.');
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        let userMessage = messageInput.value?.trim() || '';
        let imageInfo = null;
        let imageDescription = '';
        let imagePath = null;

        // Check if there's an image selected
        if (this.selectedImage) {
            // Upload and analyze image first
            imageInfo = await this.uploadAndAnalyzeImage();
            if (!imageInfo) {
                return; // Error already shown in uploadAndAnalyzeImage
            }
            
            imageDescription = imageInfo.description;
            imagePath = imageInfo.imagePath;
        }

        // اگر هیچ متنی و هیچ تصویری نیست، خطا بده
        if (!userMessage && !imageDescription) {
            console.warn('پیام خالی ارسال نمی‌شود');
            return;
        }

        // بررسی محدودیت کاراکتر (2000 کاراکتر)
        if (userMessage.length > 2000) {
            alert('پیام شما نمی‌تواند بیش از ۲۰۰۰ کاراکتر باشد');
            return;
        }

        if (this.userCredits < 1) {
            this.showCreditsWarning();
            return;
        }

        // Auto-create session if none exists
        let sessionId = this.currentSessionId || 'auto';

        // Clear input and disable send button
        messageInput.value = '';
        messageInput.style.height = 'auto';
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;

        // بررسی محدودیت پیام قبل از ارسال
        if (!this.canSendMessage()) {
            sendBtn.disabled = false;
            messageInput.value = userMessage; // بازگردانی متن
            return;
        }

        // Add user message to DOM immediately (with image if exists)
        await this.addMessageToDOM('user', userMessage, new Date(), false, imageInfo?.imageUrl);
        this.showTypingIndicator();

        try {
            const response = await fetch(`/api/sno/sessions/${sessionId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    userMessage: userMessage,
                    imageDescription: imageDescription,
                    hasImage: !!imageInfo,
                    imagePath: imagePath
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            this.hideTypingIndicator();
            sendBtn.disabled = false;

            if (data.success) {
                // If this was an auto-created session, update current session
                if (sessionId === 'auto' && data.sessionId) {
                    this.currentSessionId = data.sessionId;
                    // Update the chat title with the session title
                    // Keep title as SnoChat - document.getElementById('chatTitle').textContent = data.sessionTitle;
                    // Reload sessions to show the new one
                    await this.loadSessions();
                }

                // Add AI response to DOM
                await this.addMessageToDOM('assistant', data.aiResponse);
                
                // بروزرسانی شمارش پیام‌های جاری بعد از دریافت پاسخ AI
                // اضافه کردن پیام کاربر (که قبلاً اضافه شده)
                this.currentMessages.push({ sender_type: 'user', content: userMessage, created_at: Date.now() / 1000 });
                // اضافه کردن پاسخ AI
                this.currentMessages.push({ sender_type: 'assistant', content: data.aiResponse, created_at: Date.now() / 1000 });
                
                // بررسی محدودیت
                this.checkMessageLimit();

                // Update credits
                this.userCredits = data.remainingCredits;
                this.updateCreditsDisplay();

                if (this.userCredits < 1) {
                    this.showCreditsWarning();
                }
            } else {
                if (data.insufficientCredits) {
                    this.showCreditsWarning();
                } else {
                    alert(data.message || 'خطا در ارسال پیام');
                }
            }
        } catch (error) {
            console.error('خطا در ارسال پیام:', error);
            this.hideTypingIndicator();
            sendBtn.disabled = false;

            let errorMessage = 'خطا در ارسال پیام. لطفاً دوباره تلاش کنید.';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'خطا در اتصال به سرور. اتصال اینترنت خود را بررسی کنید.';
            } else if (error.message.includes('403')) {
                errorMessage = 'دسترسی غیرمجاز. لطفاً دوباره وارد شوید.';
            }

            this.showErrorMessage(errorMessage);
        }
    }

    async addMessageToDOM(senderType, content, timestamp = new Date(), isHistorical = false, imageUrl = null) {
        try {
            const messagesContainer = document.getElementById('messagesContainer');
            const emptyChat = document.getElementById('emptyChat');
            const typingIndicator = document.getElementById('typingIndicator');

            if (!messagesContainer) {
                console.error('عنصر messagesContainer یافت نشد');
                return;
            }

            // Validate inputs more strictly
            if (!senderType || typeof senderType !== 'string') {
                console.warn('نوع فرستنده نامعتبر:', senderType);
                return;
            }

            // Convert content to string
            const stringContent = String(content || '').trim();

            // برای پیام‌های کاربر، اگر تصویر داریم ولی متن نداریم، اجازه بده
            if (stringContent === '' && !(imageUrl && senderType === 'user')) {
                console.warn('محتوای پیام خالی است');
                return;
            }

            // Ensure timestamp is valid
            if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
                timestamp = new Date();
            }

            if (emptyChat) {
                emptyChat.style.display = 'none';
            }

            // Use the validated string content
            const safeContent = stringContent.substring(0, 5000); // Limit message length

            // بررسی وجود --- برای جداسازی بخش‌ها در پیام‌های AI
            if (senderType === 'assistant' && safeContent && safeContent.includes('---')) {
                await this.renderSectionedMessage(safeContent, messagesContainer, typingIndicator, isHistorical);
            } else {
                // رندر پیام معمولی (بدون جداسازی)
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${senderType}`;
                
                // فقط برای پیام‌های جدید AI انیمیشن ورود اضافه کن
                if (!isHistorical && senderType === 'assistant') {
                    messageDiv.style.opacity = '0';
                    messageDiv.style.transform = 'translateY(20px)';
                }

                // Add image if provided (برای کاربر فقط) - نمایش تصویر در بالای پیام
                if (imageUrl && senderType === 'user') {
                    const imageContainer = document.createElement('div');
                    imageContainer.className = 'message-image-container';
                    
                    const imageElement = document.createElement('img');
                    imageElement.src = imageUrl;
                    
                    // اگر پیام متنی همراه عکس داریم، عکس را کوچک و مربعی نمایش بده
                    // اگر فقط عکس داریم (بدون متن)، بزرگتر نمایش بده
                    if (stringContent && stringContent !== '[تصویر ارسالی]') {
                        imageElement.className = 'message-image message-image-small';
                    } else {
                        imageElement.className = 'message-image message-image-large';
                    }
                    
                    imageElement.alt = 'تصویر ارسالی';
                    imageElement.style.cursor = 'pointer';
                    
                    // اضافه کردن event listener برای باز کردن modal
                    imageElement.addEventListener('click', () => {
                        this.openImageModal(imageUrl);
                    });
                    
                    imageContainer.appendChild(imageElement);
                    messageDiv.appendChild(imageContainer);
                }

                // فقط اگر متن داریم، اضافه کن
                if (safeContent) {
                    // استفاده از MessageRenderer برای نمایش پیام‌ها
                    if (this.messageRenderer) {
                        // برای پیام‌های کاربر: نمایش فوری
                        if (senderType === 'user') {
                            await this.messageRenderer.renderInstant(safeContent, messageDiv);
                        } 
                        // برای پیام‌های هوش مصنوعی: 
                        else if (senderType === 'assistant') {
                            // اگر پیام تاریخی است (بارگذاری از قبل)، بدون انیمیشن نمایش بده
                            if (isHistorical) {
                                await this.messageRenderer.renderInstant(safeContent, messageDiv);
                            } else {
                                // برای پیام‌های جدید تایپ‌رایتر کندتر اجرا کن (6ms به جای 3ms)
                                await this.messageRenderer.renderWithTypewriter(safeContent, messageDiv, 6);
                            }
                        }
                    } else {
                        // پشتیبانی برای حالت بدون MessageRenderer
                        const contentDiv = document.createElement('div');
                        contentDiv.textContent = safeContent;
                        messageDiv.appendChild(contentDiv);
                    }
                }

                // Safely insert before typing indicator
                if (typingIndicator && typingIndicator.parentNode === messagesContainer) {
                    messagesContainer.insertBefore(messageDiv, typingIndicator);
                } else {
                    messagesContainer.appendChild(messageDiv);
                }

                // فقط برای پیام‌های جدید AI انیمیشن ورود اجرا کن
                if (!isHistorical && senderType === 'assistant') {
                    // اجرای انیمیشن ورود
                    requestAnimationFrame(() => {
                        messageDiv.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        messageDiv.style.opacity = '1';
                        messageDiv.style.transform = 'translateY(0)';
                    });

                    // اسکرول smooth به پیام جدید
                    setTimeout(() => {
                        this.smoothScrollToMessage(messageDiv);
                    }, 100);
                }
            }

        } catch (error) {
            console.error('خطا در افزودن پیام به رابط کاربری:', error);
            // Fallback: نمایش ساده پیام در صورت خطا
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${senderType}`;
            messageDiv.textContent = content;
            
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                messagesContainer.appendChild(messageDiv);
            }
        }
    }

    async renderSectionedMessage(content, messagesContainer, typingIndicator, isHistorical) {
        // استخراج code blocks قبل از split کردن
        const codeBlockStorage = [];
        let processedContent = content;

        // جایگزینی موقت code blocks با placeholder های یکتا
        processedContent = processedContent.replace(/```[\s\S]*?```/g, (match) => {
            const uuid = `CODEBLOCKSEPARATOR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            codeBlockStorage.push({ uuid, content: match });
            return uuid;
        });

        // حالا می‌توانیم بر اساس --- تقسیم کنیم بدون نگرانی از code blocks
        const sections = processedContent.split(/^---+$/m).map(s => s.trim()).filter(s => s);

        // بازگرداندن code blocks به sections
        const restoredSections = sections.map(section => {
            let restored = section;
            codeBlockStorage.forEach(({ uuid, content }) => {
                restored = restored.replace(uuid, content);
            });
            return restored;
        });

        // رندر هر بخش در یک باکس جداگانه با انیمیشن مستقل
        for (let i = 0; i < restoredSections.length; i++) {
            const section = restoredSections[i];
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'message assistant';
            
            // فقط برای پیام‌های جدید انیمیشن ورود اضافه کن
            if (!isHistorical) {
                sectionDiv.style.opacity = '0';
                sectionDiv.style.transform = 'translateY(20px)';
            }

            if (this.messageRenderer) {
                if (isHistorical) {
                    // پیام‌های تاریخی بدون انیمیشن
                    await this.messageRenderer.renderInstant(section, sectionDiv);
                } else {
                    // برای پیام‌های جدید، تایپ‌رایتر کندتر (6ms) با تاخیر بین بخش‌ها
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    await this.messageRenderer.renderWithTypewriter(section, sectionDiv, 6);
                }
            } else {
                sectionDiv.textContent = section;
            }

            // اضافه کردن هر بخش به messagesContainer
            if (typingIndicator && typingIndicator.parentNode === messagesContainer) {
                messagesContainer.insertBefore(sectionDiv, typingIndicator);
            } else {
                messagesContainer.appendChild(sectionDiv);
            }

            // فقط برای پیام‌های جدید انیمیشن ورود اجرا کن
            if (!isHistorical) {
                // انیمیشن ورود هر بخش به صورت مستقل
                requestAnimationFrame(() => {
                    sectionDiv.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    sectionDiv.style.opacity = '1';
                    sectionDiv.style.transform = 'translateY(0)';
                });

                // اسکرول smooth به بخش جدید با تاخیر کمتر
                setTimeout(() => {
                    this.smoothScrollToMessage(sectionDiv);
                }, 100);
            }
        }
    }

    showTypingIndicator() {
        document.getElementById('typingIndicator').style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        document.getElementById('typingIndicator').style.display = 'none';
    }

    clearMessages() {
        try {
            const messagesContainer = document.getElementById('messagesContainer');
            const emptyChat = document.getElementById('emptyChat');
            const typingIndicator = document.getElementById('typingIndicator');

            if (!messagesContainer) {
                console.error('عنصر messagesContainer یافت نشد');
                return;
            }

            // Clear all children except essential elements
            const children = Array.from(messagesContainer.children);
            children.forEach(child => {
                if (child.id !== 'emptyChat' && child.id !== 'typingIndicator') {
                    try {
                        messagesContainer.removeChild(child);
                    } catch (e) {
                        console.warn('خطا در حذف عنصر:', e);
                    }
                }
            });

            // Ensure essential elements are in container
            if (emptyChat && !messagesContainer.contains(emptyChat)) {
                messagesContainer.appendChild(emptyChat);
            }
            if (typingIndicator && !messagesContainer.contains(typingIndicator)) {
                messagesContainer.appendChild(typingIndicator);
            }

            if (emptyChat) {
                emptyChat.style.display = 'flex';
            }

            // Keep title as SnoChat
            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle) {
                // chatTitle.textContent = 'چت جدید';
            }

            // Update sessions display
            this.renderSessions();

        } catch (error) {
            console.error('خطا در پاک کردن پیام‌ها:', error);
        }
    }

    updateCreditsDisplay() {
        document.getElementById('creditsCount').textContent = this.userCredits;

        if (this.userCredits < 1) {
            this.showCreditsWarning();
        } else {
            this.hideCreditsWarning();
        }
    }

    showCreditsWarning() {
        document.getElementById('creditsWarning').style.display = 'block';
    }

    hideCreditsWarning() {
        document.getElementById('creditsWarning').style.display = 'none';
    }

    smoothScrollToMessage(messageElement) {
        try {
            if (!messageElement) return;
            
            // اسکرول smooth به پیام جدید
            messageElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        } catch (error) {
            console.error('خطا در اسکرول به پیام:', error);
        }
    }

    scrollToBottom() {
        try {
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                // Force scroll to bottom with smooth behavior
                messagesContainer.scrollTo({
                    top: messagesContainer.scrollHeight,
                    behavior: 'smooth'
                });
                
                // Backup scroll method for better compatibility
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 50);
            }
        } catch (error) {
            console.error('خطا در اسکرول به پایین:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'error') {
        // Remove any existing toast messages
        const existingToasts = document.querySelectorAll('.toast-message');
        existingToasts.forEach(el => el.remove());

        // Create new toast message
        const toastDiv = document.createElement('div');
        toastDiv.className = 'toast-message';
        
        const backgroundColor = type === 'error' ? '#ff4444' : '#28a745';
        
        toastDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 350px;
            font-family: inherit;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        toastDiv.textContent = message;

        // Add CSS animation if not already exists
        if (!document.getElementById('toast-animation-style')) {
            const style = document.createElement('style');
            style.id = 'toast-animation-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toastDiv);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toastDiv.parentNode) {
                toastDiv.remove();
            }
        }, 4000);

        // Click to dismiss
        toastDiv.addEventListener('click', () => toastDiv.remove());
    }

    // ماژول مدیریت محدودیت پیام‌ها
    canSendMessage() {
        // بررسی دقیق تعداد پیام‌ها - حداکثر ۱۳ پیام
        const messageCount = this.currentMessages.length;
        console.log(`Current messages count: ${messageCount}, Max allowed: ${this.maxMessagesPerSession}`);
        return messageCount < this.maxMessagesPerSession;
    }

    checkMessageLimit() {
        const canSend = this.canSendMessage();
        console.log(`Can send message: ${canSend}`);
        
        if (!canSend) {
            this.showMessageLimitReached();
        } else {
            this.hideMessageLimitReached();
        }
    }

    showMessageLimitReached() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const attachBtn = document.getElementById('attachBtn');
        const inputArea = messageInput.parentElement;

        // مخفی کردن input و send button
        messageInput.style.display = 'none';
        sendBtn.style.display = 'none';
        attachBtn.style.display = 'none';

        // چک کردن اینکه پیام محدودیت قبلاً اضافه نشده
        if (!document.getElementById('messageLimitWarning')) {
            const limitMessage = document.createElement('div');
            limitMessage.id = 'messageLimitWarning';
            limitMessage.className = 'message-limit-warning';
            limitMessage.innerHTML = `
                <div class="limit-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="limit-text">
                    <div class="limit-title">محدودیت پیام</div>
                    <div class="limit-description">
                        شما به حداکثر تعداد پیام‌های مجاز (<strong>${this.maxMessagesPerSession} پیام</strong>) رسیده‌اید
                    </div>
                    <div class="limit-action">
                        <span style="color: #007BFF; font-weight: 600;">لطفاً یک چت جدید ایجاد کنید</span>
                    </div>
                </div>
            `;
            
            inputArea.appendChild(limitMessage);
        }
    }

    hideMessageLimitReached() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const attachBtn = document.getElementById('attachBtn');
        const limitWarning = document.getElementById('messageLimitWarning');

        // نمایش دوباره input و send button
        messageInput.style.display = 'block';
        sendBtn.style.display = 'flex';
        attachBtn.style.display = 'flex';

        // حذف پیام محدودیت اگر وجود داره
        if (limitWarning) {
            limitWarning.remove();
        }
    }

    async handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            this.showErrorMessage('لطفاً فقط فایل تصویری انتخاب کنید');
            return;
        }

        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            this.showErrorMessage('حجم فایل نباید بیشتر از ۱۰ مگابایت باشد');
            return;
        }

        // Show image preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('previewImg');
            const imagePreview = document.getElementById('imagePreview');
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Store the file for later upload
        this.selectedImage = file;
    }

    clearImagePreview() {
        const imagePreview = document.getElementById('imagePreview');
        const imageInput = document.getElementById('imageInput');
        const previewImg = document.getElementById('previewImg');
        
        imagePreview.style.display = 'none';
        previewImg.src = '';
        imageInput.value = '';
        this.selectedImage = null;
        this.imageDescription = null;
    }

    async uploadAndAnalyzeImage() {
        if (!this.selectedImage) return null;

        const formData = new FormData();
        formData.append('image', this.selectedImage);

        const attachBtn = document.getElementById('attachBtn');
        const sendBtn = document.getElementById('sendBtn');
        attachBtn.disabled = true;
        sendBtn.disabled = true;

        try {
            const response = await fetch('/api/sno/upload-image', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // Update credits
                this.userCredits = data.remainingCredits;
                this.updateCreditsDisplay();

                // Store image info for display in chat
                const imageInfo = {
                    description: data.description,
                    imageUrl: data.imageUrl,
                    imagePath: data.imagePath
                };

                // Clear preview after successful upload
                this.clearImagePreview();
                
                attachBtn.disabled = false;
                sendBtn.disabled = false;

                return imageInfo;
            } else {
                throw new Error(data.message || 'خطا در آپلود تصویر');
            }
        } catch (error) {
            console.error('خطا در آپلود تصویر:', error);
            this.showErrorMessage(error.message || 'خطا در آپلود تصویر');
            attachBtn.disabled = false;
            sendBtn.disabled = false;
            return null;
        }
    }

    showLogoutModal() {
        document.getElementById('logoutModal').style.display = 'flex';
    }

    hideLogoutModal() {
        document.getElementById('logoutModal').style.display = 'none';
    }

    async confirmLogout() {
        this.hideLogoutModal();

        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/';
            } else {
                this.showErrorMessage('خطا در خروج');
            }
        } catch (error) {
            console.error('خطا در خروج:', error);
            this.showErrorMessage('خطا در خروج');
        }
    }

    // Image Modal Functions
    openImageModal(imageUrl) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        
        if (modal && modalImage) {
            modalImage.src = imageUrl;
            modal.style.display = 'flex';
        }
    }

    closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Initialize the chat application
const snoChat = new SNOChat();