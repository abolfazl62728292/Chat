const DatabaseModule = require('./database');
const SecurityModule = require('./security');

class LoginModule {

    // Login user
    static async loginUser(req, res, sessionCallback, redirectTo = '/panel') {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ success: false, message: 'نام کاربری/شماره تماس و رمز عبور الزامی است' });
        }

        let user = null;

        // Check if login is phone number or username
        const isPhone = SecurityModule.validateIranianPhone(login);

        if (isPhone) {
            const normalizedPhone = SecurityModule.normalizeIranianPhone(login);

            DatabaseModule.getUserByPhone(normalizedPhone, async (err, foundUser) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                await LoginModule.processLogin(foundUser, password, res, sessionCallback, redirectTo);
            });
        } else {
            DatabaseModule.getUserByUsername(login, async (err, foundUser) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                await LoginModule.processLogin(foundUser, password, res, sessionCallback, redirectTo);
            });
        }
    }

    static async processLogin(user, password, res, sessionCallback, redirectTo = '/panel') {
        if (!user) {
            return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
        }

        if (!user.is_verified) {
            return res.status(400).json({ success: false, message: 'حساب کاربری تایید نشده است' });
        }

        if (!user.password_hash) {
            return res.status(400).json({ success: false, message: 'لطفاً ابتدا ثبت نام را تکمیل کنید' });
        }

        try {
            // Verify password
            const isPasswordValid = await SecurityModule.verifyPassword(password, user.password_hash);

            if (!isPasswordValid) {
                return res.status(400).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است' });
            }

            // Set session data via callback
            if (sessionCallback) {
                sessionCallback({
                    id: user.id,
                    username: user.username,
                    phone: user.phone
                });
            }

            res.json({ 
                success: true, 
                message: 'ورود موفقیت‌آمیز',
                redirectTo: redirectTo
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'خطای رمزگذاری' });
        }
    }
}

module.exports = LoginModule;