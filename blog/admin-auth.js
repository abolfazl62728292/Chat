
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class BlogAdminAuth {
    static async verifyAdmin(username, password) {
        try {
            const adminUsername = process.env.BLOG_ADMIN_USERNAME;
            const adminPasswordHash = process.env.BLOG_ADMIN_PASSWORD_HASH;
            
            if (!adminUsername || !adminPasswordHash) {
                console.error('Blog admin credentials not found in blog/.env file');
                return false;
            }
            
            if (username !== adminUsername) {
                return false;
            }
            
            const isValid = await bcrypt.compare(password, adminPasswordHash);
            return isValid;
        } catch (error) {
            console.error('Error verifying blog admin credentials:', error);
            return false;
        }
    }
    
    static requireAdminAuth(req, res, next) {
        // بررسی لاگین ادمین
        if (!req.session.isBlogAdmin) {
            // تشخیص درخواست API
            const isApiRequest = req.path.startsWith('/admin') || 
                                req.headers.accept?.includes('application/json') ||
                                req.headers['content-type']?.includes('application/json');
            
            if (isApiRequest) {
                // برای API، JSON برگردان
                return res.status(401).json({ 
                    success: false, 
                    message: 'احراز هویت لازم است. لطفاً وارد شوید.' 
                });
            } else {
                // برای صفحات HTML، redirect کن
                return res.redirect('/blog/admin/login');
            }
        }
        
        // بررسی انقضای session (3 ساعت)
        if (req.session.blogAdminLoginTime) {
            const sessionAge = Date.now() - req.session.blogAdminLoginTime;
            const maxAge = 3 * 60 * 60 * 1000; // 3 hours
            
            if (sessionAge > maxAge) {
                // Session منقضی شده
                const isApiRequest = req.path.startsWith('/admin') || 
                                    req.headers.accept?.includes('application/json') ||
                                    req.headers['content-type']?.includes('application/json');
                
                req.session.destroy(() => {
                    if (isApiRequest) {
                        return res.status(401).json({ 
                            success: false, 
                            message: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' 
                        });
                    } else {
                        return res.redirect('/blog/admin/login');
                    }
                });
                return;
            }
        }
        
        next();
    }
}

module.exports = BlogAdminAuth;
