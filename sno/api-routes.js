const express = require('express');
const router = express.Router();
const multer = require('multer');
const controllers = require('./controllers');

// Configure multer for memory storage (no disk storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('فرمت فایل پشتیبانی نمی‌شود'));
        }
    }
});

// Authentication middleware for API routes
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'احراز هویت لازم است' });
    }
    
    // Extend session on activity
    req.session.touch();
    next();
};

// Chat session routes
router.get('/sessions', requireAuth, controllers.getChatSessions);
router.post('/sessions', requireAuth, controllers.createChatSession);
router.delete('/sessions/:sessionId', requireAuth, controllers.deleteChatSession);

// Message routes
router.get('/sessions/:sessionId/messages', requireAuth, controllers.getSessionMessages);

// Validation middleware for message structure
const validateMessage = (req, res, next) => {
    const { userMessage, imageDescription, hasImage } = req.body;
    
    // باید حداقل یکی از userMessage یا imageDescription وجود داشته باشد
    if ((!userMessage || userMessage.trim() === '') && (!imageDescription || imageDescription.trim() === '')) {
        return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد' });
    }
    
    next();
};

router.post('/sessions/:sessionId/messages', requireAuth, validateMessage, controllers.sendMessage);

// Image upload and analysis route
router.post('/upload-image', requireAuth, upload.single('image'), controllers.uploadImage);

// User credits route
router.get('/user-credits', requireAuth, controllers.getUserCredits);

module.exports = router;