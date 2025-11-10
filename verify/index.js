const axios = require('axios');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

class VerifyModule {
    constructor() {
        const envPath = path.join(__dirname, '.env');
        const envExists = fs.existsSync(envPath);
        
        console.log(`🔍 [Verify Module] Checking for .env file at: ${envPath}`);
        console.log(`🔍 [Verify Module] .env file exists: ${envExists ? 'Yes' : 'No'}`);
        
        this.apiKey = process.env.SMSIR_API_KEY || null;
        this.apiUrl = 'https://api.sms.ir/v1/send/verify';
        this.templateId = process.env.SMSIR_TEMPLATE_ID || null;
        this.isEnabled = Boolean(this.apiKey);
        
        if (!this.apiKey) {
            console.warn('⚠️  [Verify Module] SMSIR_API_KEY not found in environment variables. SMS sending is disabled.');
            console.warn('⚠️  [Verify Module] Verification codes will only be shown in console.');
        }
        
        if (!this.templateId && this.isEnabled) {
            console.warn('⚠️  [Verify Module] SMSIR_TEMPLATE_ID not set. You may need to specify templateId manually or in .env file.');
        }
    }

    async sendVerificationSMS(phoneNumber, verificationCode) {
        console.log(`📱 [Verify Module] Attempting to send SMS to: ${phoneNumber}`);
        console.log(`🔢 [Verify Module] Verification code: ${verificationCode}`);
        
        if (!this.isEnabled) {
            console.log('❌ [Verify Module] SMS sending is disabled (no API key configured)');
            console.log(`📝 [Verify Module] Console fallback - Code: ${verificationCode}`);
            return {
                success: false,
                fallback: true,
                message: 'API key not configured - code shown in console only',
                code: verificationCode
            };
        }

        const normalizedPhone = this.normalizePhoneForSMS(phoneNumber);
        
        if (!normalizedPhone) {
            console.error('❌ [Verify Module] Invalid phone number format:', phoneNumber);
            return {
                success: false,
                fallback: false,
                error: 'Invalid phone number format'
            };
        }

        const requestData = {
            mobile: normalizedPhone,
            templateId: this.templateId ? parseInt(this.templateId) : 100000,
            parameters: [
                {
                    name: 'Code',
                    value: verificationCode
                }
            ]
        };

        const requestConfig = {
            method: 'POST',
            url: this.apiUrl,
            headers: {
                'X-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data: requestData,
            timeout: 10000
        };

        console.log(`🚀 [Verify Module] Sending request to SMS.ir API...`);
        console.log(`📋 [Verify Module] Request details:`, {
            url: this.apiUrl,
            mobile: normalizedPhone,
            templateId: requestData.templateId,
            codeLength: verificationCode.length
        });

        try {
            const response = await axios(requestConfig);
            
            console.log('✅ [Verify Module] SMS sent successfully!');
            console.log('📊 [Verify Module] Response status:', response.status);
            console.log('📊 [Verify Module] Response data:', JSON.stringify(response.data, null, 2));
            
            return {
                success: true,
                fallback: false,
                data: response.data,
                message: 'SMS sent successfully via SMS.ir'
            };
            
        } catch (error) {
            console.error('❌ [Verify Module] Error sending SMS:', error.message);
            
            if (error.response) {
                console.error('📊 [Verify Module] Error response status:', error.response.status);
                console.error('📊 [Verify Module] Error response data:', JSON.stringify(error.response.data, null, 2));
                
                console.log('⚠️  [Verify Module] Possible reasons for failure:');
                console.log('   1. SMS.ir servers might be blocking Replit IP addresses');
                console.log('   2. API key might be invalid or expired');
                console.log('   3. Template ID might be incorrect');
                console.log('   4. Network connectivity issues between Replit and Iranian servers');
                console.log('');
                console.log('💡 [Verify Module] Recommendation: Test this code in an Iranian hosting environment');
                console.log('💡 [Verify Module] Falling back to console output for now');
                console.log(`📝 [Verify Module] Verification code for ${normalizedPhone}: ${verificationCode}`);
                
                return {
                    success: false,
                    fallback: true,
                    error: error.response.data,
                    httpStatus: error.response.status,
                    code: verificationCode,
                    message: 'SMS.ir API error - code shown in console'
                };
                
            } else if (error.request) {
                console.error('❌ [Verify Module] No response received from SMS.ir');
                console.error('📊 [Verify Module] This usually means:');
                console.error('   - SMS.ir servers are unreachable from this location');
                console.error('   - Replit servers may be blocked by Iranian firewall');
                console.error('   - Network timeout or connectivity issue');
                console.log('');
                console.log('💡 [Verify Module] STRONGLY RECOMMENDED: Deploy to Iranian hosting for testing');
                console.log(`📝 [Verify Module] Verification code for ${normalizedPhone}: ${verificationCode}`);
                
                return {
                    success: false,
                    fallback: true,
                    error: 'No response from SMS.ir (possible network/firewall issue)',
                    code: verificationCode,
                    message: 'Cannot reach SMS.ir from this server - code shown in console'
                };
                
            } else {
                console.error('❌ [Verify Module] Request setup error:', error.message);
                console.log(`📝 [Verify Module] Verification code for ${normalizedPhone}: ${verificationCode}`);
                
                return {
                    success: false,
                    fallback: true,
                    error: error.message,
                    code: verificationCode,
                    message: 'SMS request failed - code shown in console'
                };
            }
        }
    }

    normalizePhoneForSMS(phone) {
        if (!phone) return null;
        
        let normalized = phone.replace(/[^\d+]/g, '');
        
        if (normalized.startsWith('+98')) {
            return normalized.substring(1);
        } else if (normalized.startsWith('98')) {
            return normalized;
        } else if (normalized.startsWith('09')) {
            return '98' + normalized.substring(1);
        } else if (normalized.startsWith('9')) {
            return '98' + normalized;
        }
        
        return null;
    }

    async testConnection() {
        console.log('\n🔍 [Verify Module] Testing SMS.ir connection...');
        console.log(`📊 [Verify Module] API Key configured: ${this.isEnabled ? 'Yes' : 'No'}`);
        console.log(`📊 [Verify Module] Template ID: ${this.templateId || 'Not set (using default)'}`);
        
        if (!this.isEnabled) {
            console.log('⚠️  [Verify Module] Cannot test - API key not configured');
            return false;
        }
        
        const testResult = await this.sendVerificationSMS('09123456789', '1234');
        console.log(`📊 [Verify Module] Test result:`, testResult.success ? '✅ Success' : '❌ Failed');
        
        return testResult.success;
    }
}

const verifyModule = new VerifyModule();

module.exports = verifyModule;
