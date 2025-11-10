const databaseModule = require('../database');
const plansModule = require('../plans');
const geminiModule = require('./gemini');
const fs = require('fs');
const path = require('path');

class SnoControllers {
    // Get user's chat sessions
    static async getChatSessions(req, res) {
        const userId = req.session.userId;
        
        try {
            const sessions = await new Promise((resolve, reject) => {
                databaseModule.getUserChatSessions(userId, (err, sessions) => {
                    if (err) return reject(err);
                    resolve(sessions || []);
                });
            });
            
            res.json({ success: true, sessions });
            
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            res.status(500).json({ 
                success: false, 
                message: 'خطا در بارگیری جلسات چت. لطفاً دوباره تلاش کنید.' 
            });
        }
    }

    // Create new chat session
    static createChatSession(req, res) {
        const userId = req.session.userId;
        const { title } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, message: 'عنوان جلسه الزامی است' });
        }

        databaseModule.createChatSession(userId, title.trim(), (err, sessionId) => {
            if (err) {
                console.error('Error creating chat session:', err);
                return res.status(500).json({ success: false, message: 'خطا در ایجاد جلسه چت' });
            }
            
            res.json({ success: true, sessionId, message: 'جلسه چت با موفقیت ایجاد شد' });
        });
    }

    // Create auto chat session with title from message
    static createAutoSession(userId, message, callback) {
        // Generate title from first part of message (up to 50 chars)
        let title = message.length > 50 ? message.substring(0, 50) + '...' : message;
        
        databaseModule.createChatSession(userId, title, (err, sessionId) => {
            if (err) {
                console.error('Error creating auto session:', err);
                return callback(err, null);
            }
            callback(null, sessionId);
        });
    }

    // Update session title
    static updateSessionTitle(sessionId, title, callback) {
        databaseModule.updateChatSessionTitle(sessionId, title, callback);
    }

    // Delete chat session
    static deleteChatSession(req, res) {
        const userId = req.session.userId;
        const { sessionId } = req.params;
        
        // First verify the session belongs to the user and is active
        databaseModule.getChatSessionById(sessionId, (err, session) => {
            if (err) {
                console.error('Error fetching session:', err);
                return res.status(500).json({ success: false, message: 'خطا در بارگیری جلسه' });
            }
            
            if (!session || session.user_id !== userId || session.status === 'deleted') {
                return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
            }
            
            databaseModule.deleteChatSession(sessionId, (err) => {
                if (err) {
                    console.error('Error deleting chat session:', err);
                    return res.status(500).json({ success: false, message: 'خطا در حذف جلسه چت' });
                }
                
                res.json({ success: true, message: 'جلسه چت با موفقیت حذف شد' });
            });
        });
    }

    // Get messages for a chat session
    static async getSessionMessages(req, res) {
        const userId = req.session.userId;
        const { sessionId } = req.params;
        
        try {
            // First verify the session belongs to the user and is active
            const session = await new Promise((resolve, reject) => {
                databaseModule.getChatSessionById(sessionId, (err, session) => {
                    if (err) return reject(err);
                    resolve(session);
                });
            });
            
            if (!session) {
                return res.status(404).json({ success: false, message: 'جلسه چت یافت نشد' });
            }
            
            if (session.user_id !== userId || session.status === 'deleted') {
                return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
            }
            
            const messages = await new Promise((resolve, reject) => {
                databaseModule.getSessionMessages(sessionId, (err, messages) => {
                    if (err) return reject(err);
                    resolve(messages || []);
                });
            });
            
            res.json({ success: true, messages });
            
        } catch (error) {
            console.error('Error in getSessionMessages:', error);
            res.status(500).json({ 
                success: false, 
                message: 'خطا در بارگیری پیام‌ها. لطفاً دوباره تلاش کنید.' 
            });
        }
    }

    // Send message and get AI response
    static async sendMessage(req, res) {
        const userId = req.session.userId;
        let { sessionId } = req.params;
        const { userMessage, imageDescription, hasImage, imagePath } = req.body;
        
        // ترکیب پیام برای AI
        let messageForAI = '';
        
        if (hasImage && imageDescription) {
            if (userMessage && userMessage.trim() !== '') {
                // اگر هم تصویر و هم متن داریم
                messageForAI = `[تصویر ارسالی - متن معادل: ${imageDescription}]\n\nپیام کاربر: ${userMessage}`;
            } else {
                // فقط تصویر
                messageForAI = `[تصویر ارسالی - متن معادل: ${imageDescription}]`;
            }
        } else {
            // فقط متن
            messageForAI = userMessage;
        }
        
        if (!messageForAI || messageForAI.trim() === '') {
            return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد' });
        }

        try {
            // Check user credits first
            const credits = await new Promise((resolve, reject) => {
                plansModule.getUserPlan(userId, (err, planData) => {
                    if (err) return reject(err);
                    resolve(planData);
                });
            });

            if (!credits || credits.sno < 1) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'اعتبار SNO شما کافی نیست. برای ادامه چت نیاز به حداقل ۱ اعتبار دارید.',
                    insufficientCredits: true
                });
            }

            let session = null;

            // If sessionId is 'auto', create a new session automatically
            if (sessionId === 'auto') {
                // استفاده از userMessage یا عنوان پیش‌فرض برای تولید عنوان session
                const titleForSession = userMessage && userMessage.trim() !== '' 
                    ? userMessage.trim() 
                    : (hasImage ? 'گفتگو با تصویر' : 'چت جدید');
                
                sessionId = await new Promise((resolve, reject) => {
                    SnoControllers.createAutoSession(userId, titleForSession, (err, newSessionId) => {
                        if (err) return reject(err);
                        resolve(newSessionId);
                    });
                });
                
                // Get the newly created session
                session = await new Promise((resolve, reject) => {
                    databaseModule.getChatSessionById(sessionId, (err, session) => {
                        if (err) return reject(err);
                        resolve(session);
                    });
                });
            } else {
                // Verify session belongs to user
                session = await new Promise((resolve, reject) => {
                    databaseModule.getChatSessionById(sessionId, (err, session) => {
                        if (err) return reject(err);
                        resolve(session);
                    });
                });

                if (!session || session.user_id !== userId) {
                    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
                }
            }

            // Get conversation history for context
            const messages = await new Promise((resolve, reject) => {
                databaseModule.getSessionMessages(sessionId, (err, messages) => {
                    if (err) return reject(err);
                    resolve(messages || []);
                });
            });

            // ذخیره متن کاربر همراه با اطلاعات عکس
            const userMessageToSave = userMessage && userMessage.trim() !== '' ? userMessage.trim() : (hasImage ? '[تصویر ارسالی]' : '');
            
            await new Promise((resolve, reject) => {
                databaseModule.saveChatMessage(
                    sessionId, 
                    userId, 
                    'user', 
                    userMessageToSave, 
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    },
                    imagePath || null,
                    imageDescription || null
                );
            });

            // Prepare conversation context for AI
            const conversationHistory = messages.map(msg => {
                let messageContent = msg.content;
                
                // اگر پیام کاربر دارای تصویر است، اطلاعات تصویر را به محتوا اضافه کن
                if (msg.sender_type === 'user' && msg.image_description) {
                    if (msg.content && msg.content.trim() !== '' && msg.content !== '[تصویر ارسالی]') {
                        // هم تصویر و هم متن داریم
                        messageContent = `[تصویر ارسالی - متن معادل: ${msg.image_description}]\n\nپیام کاربر: ${msg.content}`;
                    } else {
                        // فقط تصویر داریم
                        messageContent = `[تصویر ارسالی - متن معادل: ${msg.image_description}]`;
                    }
                }
                
                return {
                    role: msg.sender_type === 'user' ? 'user' : 'model',
                    parts: [{ text: messageContent }]
                };
            });
            
            // Add the new user message (with image description for AI context)
            conversationHistory.push({
                role: 'user',
                parts: [{ text: messageForAI.trim() }]
            });

            // Get AI response
            let aiResponse;
            try {
                aiResponse = await geminiModule.getChatResponse(conversationHistory);
                
                if (!aiResponse || aiResponse.trim() === '') {
                    throw new Error('پاسخ خالی از سرویس هوش مصنوعی');
                }
            } catch (aiError) {
                console.error('AI Response Error:', aiError);
                throw aiError;
            }

            // Save AI response
            await new Promise((resolve, reject) => {
                databaseModule.saveChatMessage(sessionId, userId, 'assistant', aiResponse, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Deduct credits after successful AI response
            await new Promise((resolve, reject) => {
                plansModule.deductCredits(userId, 'sno', 1, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            res.json({ 
                success: true, 
                message: 'پیام با موفقیت ارسال شد',
                aiResponse: aiResponse,
                remainingCredits: credits.sno - 1,
                sessionId: sessionId,  // Include sessionId for auto-created sessions
                sessionTitle: session.title
            });

        } catch (error) {
            console.error('Error in sendMessage:', error);
            
            // Determine error type and provide appropriate message
            let errorMessage = 'خطا در ارسال پیام. لطفاً دوباره تلاش کنید.';
            let statusCode = 500;
            
            if (error.message.includes('API_KEY') || error.message.includes('کلید API')) {
                errorMessage = 'خطا در تنظیمات هوش مصنوعی. لطفاً با پشتیبانی تماس بگیرید.';
            } else if (error.message.includes('RATE_LIMIT') || error.message.includes('محدودیت نرخ')) {
                errorMessage = 'تعداد درخواست‌ها زیاد است. لطفاً چند لحظه صبر کنید.';
                statusCode = 429;
            } else if (error.message.includes('QUOTA') || error.message.includes('سهمیه')) {
                errorMessage = 'سهمیه سرویس هوش مصنوعی تمام شده است.';
            }
            
            res.status(statusCode).json({ 
                success: false, 
                message: errorMessage
            });
        }
    }

    // Upload and analyze image
    static async uploadImage(req, res) {
        const userId = req.session.userId;
        
        try {
            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'هیچ فایلی انتخاب نشده است' 
                });
            }

            // Validate file type
            const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'فرمت فایل پشتیبانی نمی‌شود. لطفاً تصویر JPG، PNG یا GIF آپلود کنید.' 
                });
            }

            // Check file size (max 10MB)
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'حجم فایل نباید بیشتر از ۱۰ مگابایت باشد' 
                });
            }

            // Check user credits
            const credits = await new Promise((resolve, reject) => {
                plansModule.getUserPlan(userId, (err, planData) => {
                    if (err) return reject(err);
                    resolve(planData);
                });
            });

            if (!credits || credits.sno < 1) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'اعتبار شما کافی نیست. برای آنالیز تصویر نیاز به حداقل ۱ اعتبار دارید.',
                    insufficientCredits: true
                });
            }

            // Get username from session (already stored during login)
            const username = req.session.username;

            if (!username) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'اطلاعات کاربر یافت نشد' 
                });
            }

            // Analyze image with Gemini
            const imageDescription = await geminiModule.analyzeImage(req.file.buffer, req.file.mimetype);

            // Deduct credits for image analysis
            await new Promise((resolve, reject) => {
                plansModule.deductCredits(userId, 'sno', 1, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Save image to disk: storage/uploads/sno/username/unique_id.ext
            const timestamp = Date.now();
            const fileExt = path.extname(req.file.originalname) || '.jpg';
            const uniqueFilename = `${timestamp}${fileExt}`;
            const userUploadDir = path.join(__dirname, '..', 'storage', 'uploads', 'sno', username);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(userUploadDir)) {
                fs.mkdirSync(userUploadDir, { recursive: true });
            }

            const filePath = path.join(userUploadDir, uniqueFilename);
            const relativeFilePath = path.join('storage', 'uploads', 'sno', username, uniqueFilename);
            
            // Write file to disk
            fs.writeFileSync(filePath, req.file.buffer);

            // Convert image to base64 for sending to frontend
            const imageBase64 = req.file.buffer.toString('base64');
            const imageDataUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

            res.json({ 
                success: true, 
                message: 'تصویر با موفقیت آنالیز شد',
                description: imageDescription,
                imageUrl: imageDataUrl,
                imagePath: relativeFilePath,
                remainingCredits: credits.sno - 1
            });

        } catch (error) {
            console.error('Error in uploadImage:', error);
            
            let errorMessage = 'خطا در آنالیز تصویر. لطفاً دوباره تلاش کنید.';
            let statusCode = 500;
            
            if (error.message.includes('API_KEY') || error.message.includes('کلید API')) {
                errorMessage = 'خطا در تنظیمات هوش مصنوعی. لطفاً با پشتیبانی تماس بگیرید.';
            } else if (error.message.includes('RATE_LIMIT') || error.message.includes('محدودیت نرخ')) {
                errorMessage = 'تعداد درخواست‌ها زیاد است. لطفاً چند لحظه صبر کنید.';
                statusCode = 429;
            } else if (error.message.includes('QUOTA') || error.message.includes('سهمیه')) {
                errorMessage = 'سهمیه سرویس هوش مصنوعی تمام شده است.';
            }
            
            res.status(statusCode).json({ 
                success: false, 
                message: errorMessage
            });
        }
    }

    // Get user credits
    static getUserCredits(req, res) {
        const userId = req.session.userId;
        
        plansModule.getUserPlan(userId, (err, planData) => {
            if (err) {
                console.error('Error fetching user plan:', err);
                return res.status(500).json({ success: false, message: 'خطا در بارگیری اطلاعات کاربر' });
            }

            if (!planData) {
                // Initialize user with default credits if not exists
                plansModule.initializeUserCredits(userId, (err) => {
                    if (err) {
                        console.error('Error initializing user credits:', err);
                        return res.status(500).json({ success: false, message: 'خطا در مقداردهی اولیه' });
                    }

                    const defaultCredits = plansModule.getDefaultFreePlanCredits();
                    res.json({
                        success: true,
                        credits: {
                            sno: defaultCredits.sno,
                            total: defaultCredits.sno
                        }
                    });
                });
            } else {
                res.json({
                    success: true,
                    credits: {
                        sno: planData.sno,
                        total: planData.sno
                    }
                });
            }
        });
    }
}

module.exports = SnoControllers;