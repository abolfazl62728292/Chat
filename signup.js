
const DatabaseModule = require('./database');
const SecurityModule = require('./security');
const PlansModule = require('./plans');

class SignupModule {
    
    // Send verification code
    static sendVerificationCode(req, res) {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'شماره تماس الزامی است' });
        }

        // Validate Iranian phone number
        if (!SecurityModule.validateIranianPhone(phone)) {
            return res.status(400).json({ success: false, message: 'شماره تماس معتبر نیست' });
        }

        const normalizedPhone = SecurityModule.normalizeIranianPhone(phone);

        // Check if user exists and rate limit
        DatabaseModule.getUserByPhone(normalizedPhone, (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            // If user already exists and is verified, redirect to login
            if (user && user.is_verified && user.password_hash) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'این شماره قبلاً ثبت شده است. لطفاً وارد شوید',
                    redirectTo: '/login'
                });
            }

            if (user) {
                // Check rate limiting for unverified users
                const rateLimit = SecurityModule.checkRateLimit(user.failed_attempts, user.last_attempt_at);
                if (!rateLimit.allowed) {
                    return res.status(429).json({ 
                        success: false, 
                        message: `لطفاً ${Math.ceil(rateLimit.remainingTime / 60)} دقیقه صبر کنید`,
                        remainingTime: rateLimit.remainingTime
                    });
                }
            }

            // Generate verification code
            const verificationCode = SecurityModule.generateVerificationCode();

            // Save to database
            DatabaseModule.createOrUpdateUser(normalizedPhone, verificationCode, (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای ذخیره‌سازی' });
                }

                // In production, send SMS here
                console.log(`Verification code for ${normalizedPhone}: ${verificationCode}`);

                res.json({ 
                    success: true, 
                    message: 'کد تایید ارسال شد',
                    phone: normalizedPhone
                });
            });
        });
    }

    // Verify code
    static verifyCode(req, res) {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ success: false, message: 'تمامی فیلدها الزامی است' });
        }

        const normalizedPhone = SecurityModule.normalizeIranianPhone(phone);

        DatabaseModule.getUserByPhone(normalizedPhone, (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            if (!user) {
                return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
            }

            // Check if code is expired
            const now = Date.now();
            if (now > user.code_expires_at) {
                return res.status(400).json({ success: false, message: 'کد تایید منقضی شده است' });
            }

            // Check code
            if (user.verification_code !== code) {
                const newFailedAttempts = (user.failed_attempts || 0) + 1;
                
                DatabaseModule.updateFailedAttempts(normalizedPhone, newFailedAttempts, (err) => {
                    if (err) console.error('Error updating failed attempts:', err);
                });

                return res.status(400).json({ 
                    success: false, 
                    message: 'کد تایید نادرست است',
                    attemptsLeft: Math.max(0, 2 - newFailedAttempts)
                });
            }

            // Verify user
            DatabaseModule.verifyUserPhone(normalizedPhone, (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای ذخیره‌سازی' });
                }

                res.json({ success: true, message: 'شماره تماس تایید شد' });
            });
        });
    }

    // Complete signup
    static async completeSignup(req, res) {
        const { phone, username, password } = req.body;

        if (!phone || !username || !password) {
            return res.status(400).json({ success: false, message: 'تمامی فیلدها الزامی است' });
        }

        const normalizedPhone = SecurityModule.normalizeIranianPhone(phone);

        // Validate username
        const usernameValidation = SecurityModule.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                message: usernameValidation.message
            });
        }

        // Validate password
        const passwordValidation = SecurityModule.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                message: 'رمز عبور نیازمندی‌های امنیتی را ندارد',
                requirements: passwordValidation.requirements
            });
        }

        // Check if user is verified
        DatabaseModule.getUserByPhone(normalizedPhone, async (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            if (!user || !user.is_verified) {
                return res.status(400).json({ success: false, message: 'شماره تماس تایید نشده است' });
            }

            // Check if username exists
            DatabaseModule.checkUsernameExists(username, async (err, existingUser) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                if (existingUser) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'نام کاربری قبلاً استفاده شده است' 
                    });
                }

                try {
                    // Hash password
                    const passwordHash = await SecurityModule.hashPassword(password);

                    // Complete signup
                    DatabaseModule.completeUserSignup(normalizedPhone, username, passwordHash, (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'خطای ذخیره‌سازی' });
                        }

                        // Get user ID and initialize credits
                        DatabaseModule.getUserIdByPhone(normalizedPhone, (err, userData) => {
                            if (err || !userData) {
                                console.error('Error getting user ID:', err);
                                return res.status(500).json({ success: false, message: 'خطای سیستم' });
                            }

                            // Initialize free plan credits
                            PlansModule.initializeUserCredits(userData.id, (err) => {
                                if (err) {
                                    console.error('Error initializing credits:', err);
                                }
                                // Continue even if credit initialization fails
                            });

                            res.json({ 
                                success: true, 
                                message: 'ثبت‌نام با موفقیت تکمیل شد',
                                redirectTo: '/sno/panel'
                            });
                        });
                    });
                } catch (error) {
                    res.status(500).json({ success: false, message: 'خطای رمزگذاری' });
                }
            });
        });
    }
}

module.exports = SignupModule;
