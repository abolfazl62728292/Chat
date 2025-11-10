
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

class GeminiModule {
    constructor() {
        // Read API key from .env file in sno directory or use environment variable
        let apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            try {
                const envPath = require('path').join(__dirname, '.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const envLines = envContent.split('\n');
                    for (const line of envLines) {
                        if (line.startsWith('GEMINI_API_KEY=')) {
                            apiKey = line.split('=')[1].trim().replace(/"/g, '');
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error('Error reading .env file:', error);
            }
        }

        if (!apiKey) {
            console.warn('GEMINI_API_KEY نیافت شد. لطفاً کلید API را در فایل sno/.env قرار دهید');
            this.genAI = null;
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
        } catch (error) {
            console.error('Error initializing GoogleGenerativeAI:', error);
            this.genAI = null;
        }
    }

    async getChatResponse(conversationHistory, retryCount = 0) {
        if (!this.genAI) {
            throw new Error('کلید API تنظیم نشده است. لطفاً کلید GEMINI_API_KEY را در فایل sno/.env قرار دهید.');
        }

        try {
            const systemInstruction = `اسمت : GPT 5 که توسط openAI آموزش دیدی
فعالیت : دستیار هوشمند فارسی که در پلتفرم اسنو‌چت(SnoChat) فعالیت میکنی.
تا ازت نپرسیده شده اسمت و فعالیتت رو نگو.
اگر کاربر محاوره ای حرف زد تو ام محاوره ای و دوستانه حرف بزن.
دقت بکن بر اساس سابقه چت و مکالماتی که با کاربر داشتی حرف بزنی.'
تو باید با دقت بالا به سوالات کاربر ها پاسخ بدی.
درصورتی که کاربر گفت توضیح بده تو توضیحات کامل رو میدی ولی در محدوده تعیین شده ،چون هدف اصلی توضیح کوتاه و متمرکز هستش بدون حاشیه.
حداکثر کلمات پاسخ(کدهای زبان برنامه نویسی) = 800 کلمه
دقت بکن اگر قرار بود ریاضیاتی حل بکنی یا هرچیز حل کردنی که فرمول داشت باید از علائم مناسب برای نمایش فرمول به کاربر استفاده بکنی تا توی فرانت اند به شکل درست و قابل فهم نمایش داده بشه به کاربر.
توجه : دقت بکن که تو خروجیت محدود هستش پس اگر خیلی طولانی شد توضیحاتت باید به کاربر بگی که توی پیام بعدیت ادامه اشو میگی تا هیچوقت وسط حرف زدنت متن نصفه نباشه.

نکته مهم درباره تصاویر: وقتی کاربر تصویر می‌فرستد، محتوای تصویر به صورت متن معادل (که توسط سیستم استخراج شده) در پیام کاربر با فرمت [تصویر ارسالی - متن معادل: ...] نمایش داده می‌شود. این متن معادل می‌تواند شامل فرمول‌های ریاضی، کدهای برنامه‌نویسی، متن‌های موجود در تصویر یا توصیف محتوای تصویر باشد. تو باید بر اساس این متن معادل با کاربر صحبت کنی و در پاسخت به محتوای تصویر اشاره کنی.دقت بکن که تنها این ساختار برای تصاویر ورودی کاربر هستش و تو خودت نمیتونی با این تصویری بسازی.
اگر کاربر برای درک بهتر به شکل نیازداشت برای سوالاتش تو اجازه داری در قالب کد شکل رو ترسیم بکنی با علامت هایی مثل * و - و ... که لازم داری و در این شرایط بهتره از نوشتن متن داخل قالب پرهیز بکنی تا کاربر شکل دقیق رو ببینه و توضیحات رو بیرون از قالب کد ارايه بده.

با --- میتونی پیام هایی که میدی رو برای حالت نمایش به کاربر اینطوری بکنی که انگار چند پیام جدا دادی مثل یک چت واقعی ولی باید درست ازش استفاده بکنی

برای درک بهتر اگر لازم شد با جدول به کاربر راهنمایی بده ولی دقت بکن باید طول متن در خونه های جدول نباید طولانی باشه چون موقع نمایش تجربه کاربری بد میشه. `;
            
            const model = this.genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash-lite',
                systemInstruction: systemInstruction
            });
            
            // Validate conversation history format
            if (!Array.isArray(conversationHistory)) {
                throw new Error('فرمت سابقه چت نامعتبر است');
            }

            // Filter out the last user message (new message) to send separately
            const history = conversationHistory.slice(0, -1);
            const newMessage = conversationHistory[conversationHistory.length - 1];

            if (!newMessage || newMessage.role !== 'user') {
                throw new Error('پیام جدید کاربر یافت نشد');
            }

            // Start chat session with history
            const chat = model.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                }
            });

            // Send the new message
            const result = await chat.sendMessage(newMessage.parts[0].text);
            const response = await result.response;
            const text = response.text();

            if (!text || text.trim() === '') {
                throw new Error('پاسخ نامعتبر از سرویس هوش مصنوعی');
            }

            return text;

        } catch (error) {
            console.error('خطا در دریافت پاسخ از Gemini:', error);
            
            // Check for 503 overload error and retry
            if (error.message && error.message.includes('overloaded') && retryCount < 3) {
                const delayMs = (retryCount + 1) * 2000; // 2s, 4s, 6s
                console.log(`🔄 سرور مدل Gemini شلوغ است. تلاش مجدد بعد از ${delayMs/1000} ثانیه... (تلاش ${retryCount + 1} از 3)`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.getChatResponse(conversationHistory, retryCount + 1);
            }
            
            // Return appropriate error message based on error type
            if (error.message && error.message.includes('API_KEY')) {
                throw new Error('کلید API نامعتبر است. لطفاً کلید صحیح را در فایل قرار دهید.');
            } else if (error.message && error.message.includes('RATE_LIMIT')) {
                throw new Error('محدودیت نرخ درخواست. لطفاً چند لحظه صبر کنید.');
            } else if (error.message && error.message.includes('QUOTA')) {
                throw new Error('سهمیه API تمام شده است.');
            } else if (error.message && error.message.includes('overloaded')) {
                throw new Error('سرور هوش مصنوعی در حال حاضر شلوغ است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.');
            } else {
                throw new Error('خطا در برقراری ارتباط با سرویس هوش مصنوعی. لطفاً دوباره تلاش کنید.');
            }
        }
    }

    // Analyze image with Gemini Vision
    async analyzeImage(imageBuffer, mimeType) {
        if (!this.genAI) {
            throw new Error('کلید API تنظیم نشده است. لطفاً کلید GEMINI_API_KEY را در فایل sno/.env قرار دهید.');
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
            
            const prompt = `این تصویر را که کاربر فرستاده است تحلیل کن و متن معادل آن را بنویس:

قوانین مهم:
1. اگر تصویر شامل فرمول ریاضی، متن نوشتاری یا کد برنامه‌نویسی است:
   - محتوای متنی را دقیقاً و کامل استخراج کن
   - فرمول‌های ریاضی را با فرمت LaTeX بنویس (مثل: $x^2 + y^2 = r^2$ یا $$\\frac{a}{b}$$)
   - کدهای برنامه‌نویسی را با حفظ فرمت و syntax بنویس
   - هیچ توضیح اضافه ندهید، فقط خود محتوا را بنویس

2. اگر تصویر یک صحنه، شی، شخص، منظره یا چیزی غیر از متن است:
   - یک توصیف واضح، کامل و دقیق از محتوای تصویر بده
   - به جزئیات مهم اشاره کن
   - زبان ساده و روان استفاده کن

فقط خروجی نهایی (متن استخراج شده یا توصیف تصویر) را بنویس، بدون هیچ توضیح اضافه درباره کاری که انجام دادی.`;

            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            if (!text || text.trim() === '') {
                throw new Error('پاسخ نامعتبر از سرویس آنالیز تصویر');
            }

            return text.trim();

        } catch (error) {
            console.error('خطا در آنالیز تصویر:', error);
            
            if (error.message && error.message.includes('API_KEY')) {
                throw new Error('کلید API نامعتبر است.');
            } else if (error.message && error.message.includes('RATE_LIMIT')) {
                throw new Error('محدودیت نرخ درخواست. لطفاً چند لحظه صبر کنید.');
            } else if (error.message && error.message.includes('QUOTA')) {
                throw new Error('سهمیه API تمام شده است.');
            } else {
                throw new Error('خطا در آنالیز تصویر. لطفاً دوباره تلاش کنید.');
            }
        }
    }

    // Test connection to Gemini API
    async testConnection() {
        if (!this.genAI) {
            return { success: false, message: 'کلید API تنظیم نشده است' };
        }

        try {
            const testResponse = await this.getChatResponse([
                {
                    role: 'user',
                    parts: [{ text: 'سلام' }]
                }
            ]);
            
            return { success: true, message: 'اتصال به Gemini موفقیت‌آمیز بود' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

// Export an instance instead of the class
module.exports = new GeminiModule();
