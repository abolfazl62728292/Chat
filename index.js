require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');
const signupModule = require('./signup');
const loginModule = require('./login');
const snoRoutes = require('./sno/routes');
const snoApiRoutes = require('./sno/api-routes');
const blogRoutes = require('./blog/routes');
const blogApiRoutes = require('./blog/api-routes');
const { sitemapGenerator } = require('./sitemap');

const migrateBlogImages = require('./blog/migrate-images-to-storage');


const app = express();
const PORT = 5000;

app.use(session({
    store: new SQLiteStore({ db: process.env.SESSIONS_DB_PATH || 'storage/database/sessions.db' }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 3 * 60 * 60 * 1000
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    req.session.touch();
    next();
}

// API routes MUST come BEFORE static middleware
app.use('/api/sno', snoApiRoutes);
app.use('/api/blog', blogApiRoutes);

// Static files middleware
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));
app.use('/sno', express.static(path.join(__dirname, 'sno/public')));

// Blog static files - این خط را حذف می‌کنیم چون در blog/routes.js مدیریت می‌شود
// app.use('/blog', express.static(path.join(__dirname, 'blog/public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use('/sno', snoRoutes);

app.use('/blog', blogRoutes);

app.get('/sitemap.xml', async (req, res) => {
    try {
        console.log('📋 Sitemap requested');
        const sitemapXml = await sitemapGenerator.getSitemap();
        
        res.set({
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=86400'
        });
        
        res.send(sitemapXml);
        console.log('✅ Sitemap served successfully');
    } catch (error) {
        console.error('❌ Error serving sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

app.post('/api/send-code', signupModule.sendVerificationCode);
app.post('/api/verify-code', signupModule.verifyCode);
app.post('/api/complete-signup', signupModule.completeSignup);
app.post('/api/login', (req, res) => {
    const returnUrl = req.body.returnUrl || req.query.return || '/sno/panel';

    loginModule.loginUser(req, res, (userData) => {
        req.session.userId = userData.id;
        req.session.phone = userData.phone;
        req.session.username = userData.username;
    }, returnUrl);
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطا در خروج' });
        }
        res.json({ success: true, message: 'با موفقیت خارج شدید' });
    });
});

app.use((req, res) => {
    // Return JSON for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    
    // Return plain text for file requests
    if (path.extname(req.path)) {
        return res.status(404).send('File not found');
    }
    
    // Return HTML for page requests
    res.status(404).send(`
        <html>
            <head>
                <title>صفحه یافت نشد</title>
                <meta charset="UTF-8">
                <style>
                    body { 
                        font-family: 'Vazirmatn', sans-serif; 
                        background: #000; 
                        color: #fff; 
                        text-align: center; 
                        padding: 2rem;
                        direction: rtl;
                    }
                    .error-container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 2rem;
                    }
                    h1 { color: #007BFF; font-size: 3rem; margin-bottom: 1rem; }
                    p { font-size: 1.2rem; margin-bottom: 2rem; }
                    a { 
                        color: #007BFF; 
                        text-decoration: none; 
                        padding: 1rem 2rem; 
                        border: 2px solid #007BFF; 
                        border-radius: 25px;
                        transition: all 0.3s ease;
                    }
                    a:hover { 
                        background: #007BFF; 
                        color: #fff; 
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>۴۰۴</h1>
                    <p>صفحه مورد نظر یافت نشد</p>
                    <a href="/">بازگشت به صفحه اصلی</a>
                </div>
            </body>
        </html>
    `);
});

try {
    console.log('🔄 Running startup migrations...');
    migrateBlogImages();
} catch (error) {
    console.error('❌ Migration error:', error);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running at http://0.0.0.0:${PORT}`);
    console.log('📁 Available routes:');
    console.log('   / -> Homepage');
    console.log('   /signup -> User registration');
    console.log('   /login -> User login');
    console.log('   /sno/panel -> AI Chat (requires authentication)');
    console.log('   /blog -> Blog posts');
    console.log('   /blog/admin -> Blog admin panel');
});