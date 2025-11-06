
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class SecurityModule {
    // Validate Iranian phone number
    static validateIranianPhone(phone) {
        const iranianPhoneRegex = /^(\+98|0098|98|0)?9\d{9}$/;
        return iranianPhoneRegex.test(phone);
    }

    // Normalize Iranian phone number
    static normalizeIranianPhone(phone) {
        // Remove all non-digit characters except +
        let normalized = phone.replace(/[^\d+]/g, '');
        
        // Convert to standard format: +989xxxxxxxxx
        if (normalized.startsWith('+98')) {
            return normalized;
        } else if (normalized.startsWith('0098')) {
            return '+98' + normalized.substring(4);
        } else if (normalized.startsWith('98')) {
            return '+' + normalized;
        } else if (normalized.startsWith('09')) {
            return '+98' + normalized.substring(1);
        } else if (normalized.startsWith('9')) {
            return '+98' + normalized;
        }
        
        return null;
    }

    // Generate 4-digit verification code
    static generateVerificationCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Validate password strength
    static validatePassword(password) {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d{4,}/.test(password); // At least 4 numbers
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const minLength = password.length >= 8;

        return {
            valid: hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && minLength,
            requirements: {
                hasUpperCase,
                hasLowerCase,
                hasNumbers,
                hasSpecialChar,
                minLength
            }
        };
    }

    // Hash password securely
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    // Verify password
    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    // Generate session token
    static generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Validate username
    static validateUsername(username) {
        // Username must be 3-20 characters, only letters, numbers, and underscores
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        const isValid = usernameRegex.test(username);
        
        // Check for reserved usernames
        const reservedUsernames = ['admin', 'root', 'user', 'guest', 'test', 'api', 'www', 'mail', 'ftp'];
        const isReserved = reservedUsernames.includes(username.toLowerCase());
        
        return {
            valid: isValid && !isReserved,
            message: isValid ? (isReserved ? 'این نام کاربری رزرو شده است' : '') : 'نام کاربری باید 3-20 کاراکتر و فقط شامل حروف، اعداد و _ باشد'
        };
    }

    // Rate limiting check
    static checkRateLimit(attempts, lastAttempt, cooldownMinutes = 2) {
        const now = Date.now();
        const cooldownMs = cooldownMinutes * 60 * 1000;
        
        if (attempts >= 2 && (now - lastAttempt) < cooldownMs) {
            return {
                allowed: false,
                remainingTime: Math.ceil((cooldownMs - (now - lastAttempt)) / 1000)
            };
        }
        
        return { allowed: true, remainingTime: 0 };
    }
}

module.exports = SecurityModule;
