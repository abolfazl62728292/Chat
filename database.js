const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseModule {
    constructor() {
        // Use environment variable or fallback to storage/database directory
        const dbPath = process.env.DATABASE_PATH || './storage/database/users.db';

        // Ensure the directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log(`📁 Created database directory: ${dbDir}`);
        }

        this.db = new sqlite3.Database(dbPath);
        console.log(`💾 Database connected: ${dbPath}`);
        this.initDatabase();
    }

    initDatabase() {
        this.db.serialize(() => {
            // Users table
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                verification_code TEXT,
                code_expires_at INTEGER,
                failed_attempts INTEGER DEFAULT 0,
                last_attempt_at INTEGER,
                is_verified INTEGER DEFAULT 0,
                username TEXT UNIQUE,
                password_hash TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`);

            // Sessions table
            this.db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                session_token TEXT UNIQUE,
                expires_at INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // User credits table
            this.db.run(`CREATE TABLE IF NOT EXISTS user_credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                plan_type TEXT DEFAULT 'free',
                sno INTEGER DEFAULT 0,
                sno_emb INTEGER DEFAULT 0,
                pano INTEGER DEFAULT 0,
                eye_2d INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Panorama requests table
            this.db.run(`CREATE TABLE IF NOT EXISTS panorama_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                request_type TEXT NOT NULL, -- 'basic', 'medium', 'advanced'
                credits_cost INTEGER NOT NULL,
                is_360 INTEGER DEFAULT 1, -- 1 for 360, 0 for less than 360
                status TEXT DEFAULT 'creating', -- 'creating', 'completed'
                images_folder TEXT, -- folder path for uploaded images
                result_image TEXT, -- final panorama image path
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                completed_at INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Chat sessions table for SNO
            this.db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'active', -- 'active' or 'deleted'
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Add status column to existing chat_sessions table if it doesn't exist
            this.db.run(`ALTER TABLE chat_sessions ADD COLUMN status TEXT DEFAULT 'active'`, () => {
                // Ignore error if column already exists
            });

            // Chat messages table for SNO
            this.db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                user_id INTEGER,
                sender_type TEXT NOT NULL, -- 'user' or 'assistant'
                content TEXT NOT NULL,
                image_path TEXT, -- مسیر فایل عکس در سرور
                image_description TEXT, -- متن معادل عکس (خروجی تحلیل AI)
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Add image_path column to existing chat_messages table if it doesn't exist
            this.db.run(`ALTER TABLE chat_messages ADD COLUMN image_path TEXT`, () => {
                // Ignore error if column already exists
            });

            // Add image_description column to existing chat_messages table if it doesn't exist
            this.db.run(`ALTER TABLE chat_messages ADD COLUMN image_description TEXT`, () => {
                // Ignore error if column already exists
            });

            // Blog categories table
            this.db.run(`CREATE TABLE IF NOT EXISTS blog_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`);

            // Blog posts table
            this.db.run(`CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                excerpt TEXT,
                category_id INTEGER,
                meta_description TEXT,
                meta_keywords TEXT,
                is_published INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (category_id) REFERENCES blog_categories (id)
            )`);

            // Blog post images table
            this.db.run(`CREATE TABLE IF NOT EXISTS blog_post_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT,
                is_main BOOLEAN DEFAULT 0,
                position INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
            )`);

            // Blog related posts table with type support
            this.db.run(`CREATE TABLE IF NOT EXISTS blog_related_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER,
                related_post_id INTEGER,
                link_type TEXT DEFAULT 'related',
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (post_id) REFERENCES blog_posts (id) ON DELETE CASCADE,
                FOREIGN KEY (related_post_id) REFERENCES blog_posts (id) ON DELETE CASCADE
            )`);

            // Blog admin users table
            this.db.run(`CREATE TABLE IF NOT EXISTS blog_admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`);


        });
    }

    // Create or update user with phone
    createOrUpdateUser(phone, verificationCode, callback) {
        const now = Date.now();
        const expiresAt = now + (2 * 60 * 1000); // 2 minutes

        this.db.run(`
            INSERT OR REPLACE INTO users 
            (phone, verification_code, code_expires_at, failed_attempts, last_attempt_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
        `, [phone, verificationCode, expiresAt, now, now], callback);
    }

    // Get user by phone
    getUserByPhone(phone, callback) {
        this.db.get(
            'SELECT * FROM users WHERE phone = ?',
            [phone],
            callback
        );
    }

    // Update failed attempts
    updateFailedAttempts(phone, attempts, callback) {
        const now = Date.now();
        this.db.run(
            'UPDATE users SET failed_attempts = ?, last_attempt_at = ? WHERE phone = ?',
            [attempts, now, phone],
            callback
        );
    }

    // Verify user phone
    verifyUserPhone(phone, callback) {
        this.db.run(
            'UPDATE users SET is_verified = 1, verification_code = NULL, code_expires_at = NULL, failed_attempts = 0 WHERE phone = ?',
            [phone],
            callback
        );
    }

    // Complete user signup
    completeUserSignup(phone, username, passwordHash, callback) {
        this.db.run(
            'UPDATE users SET username = ?, password_hash = ?, updated_at = ? WHERE phone = ? AND is_verified = 1',
            [username, passwordHash, Date.now(), phone],
            callback
        );
    }

    // Check if username exists
    checkUsernameExists(username, callback) {
        this.db.get(
            'SELECT id FROM users WHERE username = ?',
            [username],
            callback
        );
    }

    // Get user by username
    getUserByUsername(username, callback) {
        this.db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            callback
        );
    }

    // Initialize user credits
    initializeUserCredits(userId, planType, credits, callback) {
        this.db.run(
            `INSERT OR REPLACE INTO user_credits 
            (user_id, plan_type, sno, sno_emb, pano, eye_2d, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, planType, credits.sno, credits.sno_emb, credits.pano, credits.eye_2d, Date.now()],
            callback
        );
    }

    // Get user plan and credits
    getUserPlan(userId, callback) {
        this.db.get(
            'SELECT * FROM user_credits WHERE user_id = ?',
            [userId],
            callback
        );
    }

    // Update user credits
    updateUserCredits(userId, credits, callback) {
        let setParts = [];
        let values = [];

        if (credits.sno !== undefined) {
            setParts.push('sno = ?');
            values.push(credits.sno);
        }
        if (credits.sno_emb !== undefined) {
            setParts.push('sno_emb = ?');
            values.push(credits.sno_emb);
        }
        if (credits.pano !== undefined) {
            setParts.push('pano = ?');
            values.push(credits.pano);
        }
        if (credits.eye_2d !== undefined) {
            setParts.push('eye_2d = ?');
            values.push(credits.eye_2d);
        }

        setParts.push('updated_at = ?');
        values.push(Date.now());

        values.push(userId);

        this.db.run(
            `UPDATE user_credits SET ${setParts.join(', ')} WHERE user_id = ?`,
            values,
            callback
        );
    }

    // Get user ID by phone
    getUserIdByPhone(phone, callback) {
        this.db.get(
            'SELECT id FROM users WHERE phone = ?',
            [phone],
            callback
        );
    }

    // Panorama request methods
    createPanoramaRequest(userId, requestType, creditsCost, is360, imagesFolder, callback) {
        this.db.run(
            `INSERT INTO panorama_requests (user_id, request_type, credits_cost, is_360, images_folder) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, requestType, creditsCost, is360, imagesFolder],
            function(err) {
                callback(err, this ? this.lastID : null);
            }
        );
    }

    getUserPanoramaRequests(userId, callback) {
        this.db.all(
            `SELECT * FROM panorama_requests WHERE user_id = ? ORDER BY created_at DESC`,
            [userId],
            callback
        );
    }

    getAllPanoramaRequests(callback) {
        this.db.all(
            `SELECT pr.*, u.username, u.phone 
             FROM panorama_requests pr 
             JOIN users u ON pr.user_id = u.id 
             ORDER BY pr.created_at DESC`,
            callback
        );
    }

    getPanoramaRequestById(requestId, callback) {
        this.db.get(
            `SELECT pr.*, u.username, u.phone 
             FROM panorama_requests pr 
             JOIN users u ON pr.user_id = u.id 
             WHERE pr.id = ?`,
            [requestId],
            callback
        );
    }

    completePanoramaRequest(requestId, resultImagePath, callback) {
        const now = Date.now();
        this.db.run(
            `UPDATE panorama_requests SET status = 'completed', result_image = ?, completed_at = ? WHERE id = ?`,
            [resultImagePath, now, requestId],
            callback
        );
    }

    replacePanoramaResult(requestId, resultImagePath, callback) {
        const now = Date.now();
        this.db.run(
            `UPDATE panorama_requests SET result_image = ?, completed_at = ? WHERE id = ?`,
            [resultImagePath, now, requestId],
            callback
        );
    }

    deductUserCredits(userId, amount, callback) {
        this.db.run(
            `UPDATE user_credits SET pano = pano - ?, updated_at = ? WHERE user_id = ?`,
            [amount, Date.now(), userId],
            callback
        );
    }

    // Chat sessions methods for SNO
    createChatSession(userId, title, callback) {
        this.db.run(
            `INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)`,
            [userId, title],
            function(err) {
                callback(err, this ? this.lastID : null);
            }
        );
    }

    getUserChatSessions(userId, callback) {
        this.db.all(
            `SELECT * FROM chat_sessions WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC`,
            [userId],
            callback
        );
    }

    getChatSessionById(sessionId, callback) {
        this.db.get(
            `SELECT * FROM chat_sessions WHERE id = ?`,
            [sessionId],
            callback
        );
    }

    // Get active chat session by ID (for user access)
    getActiveChatSessionById(sessionId, callback) {
        this.db.get(
            `SELECT * FROM chat_sessions WHERE id = ? AND status = 'active'`,
            [sessionId],
            callback
        );
    }

    deleteChatSession(sessionId, callback) {
        const now = Date.now();
        this.db.run(
            `UPDATE chat_sessions SET status = 'deleted', updated_at = ? WHERE id = ?`,
            [now, sessionId],
            callback
        );
    }

    updateChatSessionTimestamp(sessionId, callback) {
        const now = Date.now();
        this.db.run(
            `UPDATE chat_sessions SET updated_at = ? WHERE id = ?`,
            [now, sessionId],
            callback
        );
    }

    updateChatSessionTitle(sessionId, title, callback) {
        this.db.run(
            `UPDATE chat_sessions SET title = ? WHERE id = ?`,
            [title, sessionId],
            callback
        );
    }

    // Chat messages methods for SNO
    saveChatMessage(sessionId, userId, senderType, content, callback, imagePath = null, imageDescription = null) {
        this.db.run(
            `INSERT INTO chat_messages (session_id, user_id, sender_type, content, image_path, image_description) VALUES (?, ?, ?, ?, ?, ?)`,
            [sessionId, userId, senderType, content, imagePath, imageDescription],
            (err) => {
                if (err) return callback(err);

                // Update session timestamp
                this.updateChatSessionTimestamp(sessionId, callback);
            }
        );
    }

    getSessionMessages(sessionId, callback) {
        this.db.all(
            `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
            [sessionId],
            callback
        );
    }

    deleteSessionMessages(sessionId, callback) {
        this.db.run(
            `DELETE FROM chat_messages WHERE session_id = ?`,
            [sessionId],
            callback
        );
    }

    // Blog categories methods
    getAllBlogCategories(callback) {
        this.db.all('SELECT * FROM blog_categories ORDER BY name', callback);
    }

    getBlogCategoryBySlug(slug, callback) {
        this.db.get('SELECT * FROM blog_categories WHERE slug = ?', [slug], callback);
    }

    createBlogCategory(name, slug, description, callback) {
        this.db.run(
            `INSERT INTO blog_categories (name, slug, description) VALUES (?, ?, ?)`,
            [name, slug, description || ''],
            function(err) {
                callback(err, this ? this.lastID : null);
            }
        );
    }

    updateBlogCategory(id, name, slug, description, callback) {
        const now = Date.now();
        this.db.run(
            `UPDATE blog_categories SET name = ?, slug = ?, description = ?, updated_at = ? WHERE id = ?`,
            [name, slug, description || '', now, id],
            callback
        );
    }

    deleteBlogCategory(id, callback) {
        this.db.run(
            `DELETE FROM blog_categories WHERE id = ?`,
            [id],
            callback
        );
    }

    // Blog posts methods
    createBlogPost(postData, callback) {
        const { title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published } = postData;
        this.db.run(
            `INSERT INTO blog_posts (title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published ? 1 : 0],
            function(err) {
                callback(err, this ? this.lastID : null);
            }
        );
    }

    updateBlogPost(id, postData, callback) {
        const { title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published } = postData;
        const now = Date.now();

        if (is_published === null) {
            // اگر is_published null باشد، آن را از آپدیت حذف کن
            this.db.run(
                `UPDATE blog_posts SET title = ?, slug = ?, content = ?, excerpt = ?, category_id = ?, 
                 meta_description = ?, meta_keywords = ?, updated_at = ? WHERE id = ?`,
                [title, slug, content, excerpt, category_id, meta_description, meta_keywords, now, id],
                callback
            );
        } else {
            this.db.run(
                `UPDATE blog_posts SET title = ?, slug = ?, content = ?, excerpt = ?, category_id = ?, 
                 meta_description = ?, meta_keywords = ?, is_published = ?, updated_at = ? WHERE id = ?`,
                [title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published ? 1 : 0, now, id],
                callback
            );
        }
    }

    getAllBlogPostsWithDetails(callback) {
        this.db.all(
            `SELECT p.*, c.name as category_name, c.slug as category_slug,
             (SELECT filename FROM blog_post_images WHERE post_id = p.id AND is_main = 1 LIMIT 1) as main_image
             FROM blog_posts p 
             LEFT JOIN blog_categories c ON p.category_id = c.id 
             ORDER BY p.created_at DESC`,
            callback
        );
    }

    getBlogPostById(id, callback) {
        this.db.get(
            `SELECT p.*, c.name as category_name, c.slug as category_slug
             FROM blog_posts p 
             LEFT JOIN blog_categories c ON p.category_id = c.id 
             WHERE p.id = ?`,
            [id],
            callback
        );
    }

    getPublishedBlogPosts(page = 1, limit = 10, callback) {
        const offset = (page - 1) * limit;

        // Get posts
        this.db.all(
            `SELECT p.*, c.name as category_name, c.slug as category_slug,
             (SELECT filename FROM blog_post_images WHERE post_id = p.id AND is_main = 1 LIMIT 1) as main_image
             FROM blog_posts p 
             LEFT JOIN blog_categories c ON p.category_id = c.id 
             WHERE p.is_published = 1 
             ORDER BY p.created_at DESC 
             LIMIT ? OFFSET ?`,
            [limit, offset],
            (err, posts) => {
                if (err) return callback(err);

                // Get total count
                this.db.get(
                    `SELECT COUNT(*) as count FROM blog_posts WHERE is_published = 1`,
                    (err, countResult) => {
                        if (err) return callback(err);
                        callback(null, posts, countResult.count);
                    }
                );
            }
        );
    }

    getPublishedBlogPostsByCategory(categorySlug, page = 1, limit = 10, callback) {
        const offset = (page - 1) * limit;

        // Get posts
        this.db.all(
            `SELECT p.*, c.name as category_name, c.slug as category_slug,
             (SELECT filename FROM blog_post_images WHERE post_id = p.id AND is_main = 1 LIMIT 1) as main_image
             FROM blog_posts p 
             JOIN blog_categories c ON p.category_id = c.id 
             WHERE p.is_published = 1 AND c.slug = ? 
             ORDER BY p.created_at DESC 
             LIMIT ? OFFSET ?`,
            [categorySlug, limit, offset],
            (err, posts) => {
                if (err) return callback(err);

                // Get total count
                this.db.get(
                    `SELECT COUNT(*) as count FROM blog_posts p 
                     JOIN blog_categories c ON p.category_id = c.id 
                     WHERE p.is_published = 1 AND c.slug = ?`,
                    [categorySlug],
                    (err, countResult) => {
                        if (err) return callback(err);
                        callback(null, posts, countResult.count);
                    }
                );
            }
        );
    }

    getPublishedBlogPostsByTag(tagSlug, page = 1, limit = 10, callback) {
        // This is a placeholder, tag functionality is not implemented in the DB schema yet
        console.warn("Tag functionality not implemented in database module.");
        callback(null, [], 0);
    }

    getPublishedBlogPost(categorySlug, postSlug, callback) {
        this.db.get(
            `SELECT p.*, c.name as category_name, c.slug as category_slug
             FROM blog_posts p 
             JOIN blog_categories c ON p.category_id = c.id 
             WHERE p.is_published = 1 AND c.slug = ? AND p.slug = ?`,
            [categorySlug, postSlug],
            callback
        );
    }

    deleteBlogPost(id, callback) {
        // Delete in sequence to ensure proper cleanup
        
        // First delete related posts
        this.db.run(
            `DELETE FROM blog_related_posts WHERE post_id = ? OR related_post_id = ?`,
            [id, id],
            (err) => {
                if (err) return callback(err);
                
                // Then delete post images
                this.db.run(
                    `DELETE FROM blog_post_images WHERE post_id = ?`,
                    [id],
                    (err) => {
                        if (err) return callback(err);
                        
                        // Finally delete the post itself
                        this.db.run(
                            `DELETE FROM blog_posts WHERE id = ?`,
                            [id],
                            callback
                        );
                    }
                );
            }
        );
    }

    // Blog post images methods
    addBlogPostImage(postId, filename, originalName, isMain = false, callback) {
        // Skip placeholder images
        if (filename.startsWith('panorama_') && filename.match(/^panorama_\d+\.(jpg|jpeg|png|gif|webp)$/)) {
            console.log(`Skipping placeholder image: ${filename}`);
            return callback(null);
        }

        // Get the next position for this post
        this.db.get(
            `SELECT COUNT(*) as count FROM blog_post_images WHERE post_id = ?`,
            [postId],
            (err, result) => {
                if (err) return callback(err);

                const nextPosition = (result.count || 0) + 1;

                // If this is the first image and no main image is set, make it main
                if (result.count === 0) {
                    isMain = true;
                }

                // If this is a main image, set all other images as non-main first
                if (isMain) {
                    this.db.run(
                        `UPDATE blog_post_images SET is_main = 0 WHERE post_id = ?`,
                        [postId],
                        (err) => {
                            if (err) return callback(err);

                            // Now add the new main image
                            this.db.run(
                                `INSERT INTO blog_post_images (post_id, filename, original_name, is_main, position) VALUES (?, ?, ?, 1, ?)`,
                                [postId, filename, originalName, nextPosition],
                                callback
                            );
                        }
                    );
                } else {
                    this.db.run(
                        `INSERT INTO blog_post_images (post_id, filename, original_name, is_main, position) VALUES (?, ?, ?, 0, ?)`,
                        [postId, filename, originalName, nextPosition],
                        callback
                    );
                }
            }
        );
    }

    getBlogPostImages(postId, callback) {
        this.db.all(
            `SELECT * FROM blog_post_images WHERE post_id = ? ORDER BY is_main DESC, created_at ASC`,
            [postId],
            callback
        );
    }

    deleteBlogImageByFilename(filename, callback) {
        // Delete all instances of this filename from all posts
        this.db.run(
            `DELETE FROM blog_post_images WHERE filename = ?`,
            [filename],
            function(err) {
                if (err) return callback(err);
                console.log(`Deleted ${this.changes} image records for filename: ${filename}`);
                callback(null);
            }
        );
    }

    // Blog related posts methods with link type support
    setBlogRelatedPosts(postId, relatedPostsData, callback) {
        // First delete existing related posts
        this.db.run(
            `DELETE FROM blog_related_posts WHERE post_id = ?`,
            [postId],
            (err) => {
                if (err) return callback(err);

                if (!relatedPostsData || relatedPostsData.length === 0) {
                    return callback(null);
                }

                // Insert new related posts with link types
                const placeholders = relatedPostsData.map(() => '(?, ?, ?)').join(', ');
                const values = [];
                relatedPostsData.forEach(item => {
                    values.push(postId, item.postId, item.linkType || 'related');
                });

                this.db.run(
                    `INSERT INTO blog_related_posts (post_id, related_post_id, link_type) VALUES ${placeholders}`,
                    values,
                    callback
                );
            }
        );
    }

    getBlogRelatedPosts(postId, linkType = null, callback) {
        let query = `SELECT p.*, c.name as category_name, c.slug as category_slug, br.link_type,
             (SELECT filename FROM blog_post_images WHERE post_id = p.id AND is_main = 1 LIMIT 1) as main_image
             FROM blog_related_posts br 
             JOIN blog_posts p ON br.related_post_id = p.id 
             LEFT JOIN blog_categories c ON p.category_id = c.id 
             WHERE br.post_id = ? AND p.is_published = 1`;

        let params = [postId];

        if (linkType) {
            query += ` AND br.link_type = ?`;
            params.push(linkType);
        }

        query += ` ORDER BY br.created_at ASC`;

        this.db.all(query, params, callback);
    }

    getBlogRelatedPostsByType(postId, callback) {
        this.db.all(
            `SELECT p.*, c.name as category_name, c.slug as category_slug, br.link_type,
             (SELECT filename FROM blog_post_images WHERE post_id = p.id AND is_main = 1 LIMIT 1) as main_image
             FROM blog_related_posts br 
             JOIN blog_posts p ON br.related_post_id = p.id 
             LEFT JOIN blog_categories c ON p.category_id = c.id 
             WHERE br.post_id = ? AND p.is_published = 1 
             ORDER BY br.link_type, br.created_at ASC`,
            [postId],
            (err, rows) => {
                if (err) return callback(err);

                const result = {
                    readMore: rows.filter(r => r.link_type === 'read_more'),
                    related: rows.filter(r => r.link_type === 'related')
                };

                callback(null, result);
            }
        );
    }

    // New method to update image position in content
    updateBlogImagePosition(postId, filename, position, callback) {
        this.db.run(
            `UPDATE blog_post_images SET position = ? WHERE post_id = ? AND filename = ?`,
            [position, postId, filename],
            callback
        );
    }

    // New method to get blog images with position
    getBlogPostImagesWithPosition(postId, callback) {
        this.db.all(
            `SELECT * FROM blog_post_images WHERE post_id = ? ORDER BY position ASC, is_main DESC, created_at ASC`,
            [postId],
            callback
        );
    }

    // Method to delete specific image from post
    deleteBlogPostImage(postId, filename, callback) {
        this.db.run(
            `DELETE FROM blog_post_images WHERE post_id = ? AND filename = ?`,
            [postId, filename],
            callback
        );
    }
}

module.exports = new DatabaseModule();