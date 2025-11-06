
const DatabaseModule = require('./database');

class PlansModule {
    // Default free plan credits
    static getDefaultFreePlanCredits() {
        return {
            sno: 40,
            sno_emb: 5000,
            pano: 1,
            eye_2d: 0
        };
    }

    // Initialize user credits when they complete signup
    static initializeUserCredits(userId, callback) {
        const defaultCredits = this.getDefaultFreePlanCredits();
        
        DatabaseModule.initializeUserCredits(userId, 'free', defaultCredits, callback);
    }

    // Get user plan and credits
    static getUserPlan(userId, callback) {
        DatabaseModule.getUserPlan(userId, callback);
    }

    // Update user credits (for admin use)
    static updateUserCredits(userId, credits, callback) {
        DatabaseModule.updateUserCredits(userId, credits, callback);
    }

    // Deduct credits when user uses a service
    static deductCredits(userId, service, amount, callback) {
        this.getUserPlan(userId, (err, planData) => {
            if (err) return callback(err);
            
            if (!planData) {
                return callback(new Error('کاربر یافت نشد'));
            }

            const currentCredits = planData[service] || 0;
            if (currentCredits < amount) {
                return callback(new Error('اعتبار کافی نیست'));
            }

            const newAmount = currentCredits - amount;
            const updateData = {};
            updateData[service] = newAmount;
            
            this.updateUserCredits(userId, updateData, callback);
        });
    }

    // Add credits to user (for purchases or bonuses)
    static addCredits(userId, service, amount, callback) {
        this.getUserPlan(userId, (err, planData) => {
            if (err) return callback(err);
            
            if (!planData) {
                return callback(new Error('کاربر یافت نشد'));
            }

            const currentCredits = planData[service] || 0;
            const newAmount = currentCredits + amount;
            const updateData = {};
            updateData[service] = newAmount;
            
            this.updateUserCredits(userId, updateData, callback);
        });
    }
}

module.exports = PlansModule;
