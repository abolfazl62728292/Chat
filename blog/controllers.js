const BlogAdminAuth = require('./admin-auth');
const databaseModule = require('../database');
const path = require('path');
const fs = require('fs');
const marked = require('marked');
const { optimizeImage, STORAGE_BASE_PATH } = require('./config');
const ssrUtils = require('./ssr-utils');

// Admin authentication controllers
const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'نام کاربری و رمز عبور الزامی است' });
        }

        // Input validation and sanitization
        if (username.length > 50 || password.length > 100) {
            return res.json({ success: false, message: 'نام کاربری یا رمز عبور نامعتبر است' });
        }

        const isValid = await BlogAdminAuth.verifyAdmin(username.trim(), password);

        if (isValid) {
            // Regenerate session ID for security
            req.session.regenerate((err) => {
                if (err) {
                    console.error('خطا در تولید مجدد session:', err);
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                req.session.isBlogAdmin = true;
                req.session.blogAdminUsername = username.trim();
                req.session.blogAdminLoginTime = Date.now();

                // Save session and respond
                req.session.save((err) => {
                    if (err) {
                        console.error('خطا در ذخیره session:', err);
                        return res.status(500).json({ success: false, message: 'خطای سیستم' });
                    }
                    res.json({ success: true, message: 'ورود موفقیت‌آمیز' });
                });
            });
        } else {
            res.json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است' });
        }
    } catch (error) {
        console.error('خطا در ورود ادمین بلاگ:', error);
        res.status(500).json({ success: false, message: 'خطای سیستم' });
    }
};

const adminLogout = (req, res) => {
    // Properly destroy the session for security
    req.session.destroy((err) => {
        if (err) {
            console.error('خطا در نابودی session:', err);
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        // Clear cookie
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'خروج موفقیت‌آمیز' });
    });
};

// Category management controllers
const adminGetCategories = (req, res) => {
    databaseModule.getAllBlogCategories((err, categories) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, categories: categories || [] });
    });
};

const adminCreateCategory = (req, res) => {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
        return res.json({ success: false, message: 'نام و slug الزامی است' });
    }

    databaseModule.createBlogCategory(name, slug, description, (err, categoryId) => {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.json({ success: false, message: 'این slug قبلاً استفاده شده است' });
            }
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, message: 'دسته‌بندی ایجاد شد', categoryId });
    });
};

const adminUpdateCategory = (req, res) => {
    const { id } = req.params;
    const { name, slug, description } = req.body;

    if (!name || !slug) {
        return res.json({ success: false, message: 'نام و slug الزامی است' });
    }

    databaseModule.updateBlogCategory(id, name, slug, description, (err) => {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.json({ success: false, message: 'این slug قبلاً استفاده شده است' });
            }
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, message: 'دسته‌بندی به‌روزرسانی شد' });
    });
};

const adminDeleteCategory = (req, res) => {
    const { id } = req.params;

    databaseModule.deleteBlogCategory(id, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, message: 'دسته‌بندی حذف شد' });
    });
};

// Post management controllers
const adminGetPosts = (req, res) => {
    databaseModule.getAllBlogPostsWithDetails((err, posts) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, posts: posts || [] });
    });
};

const adminGetPost = (req, res) => {
    const { id } = req.params;

    databaseModule.getBlogPostById(id, (err, post) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        if (!post) {
            return res.status(404).json({ success: false, message: 'مقاله یافت نشد' });
        }

        // Get post images with position
        databaseModule.getBlogPostImagesWithPosition(id, (err, images) => {
            if (err) {
                console.error('خطا در دریافت تصاویر:', err);
                images = [];
            }

            res.json({ 
                success: true, 
                post: {
                    ...post,
                    images: images || []
                }
            });
        });
    });
};

const adminCreatePost = (req, res) => {
    console.log('Debug - adminCreatePost called');
    const { title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published } = req.body;
    const uploadedImages = req.files || [];

    console.log('Debug - Request data:', { title, slug, content: content ? content.substring(0, 50) + '...' : 'no content' });

    if (!title || !slug || !content || !category_id) {
        return res.json({ success: false, message: 'عنوان، slug، محتوا و دسته‌بندی الزامی است' });
    }

    const postData = {
        title,
        slug,
        content,
        excerpt: excerpt || '',
        category_id: parseInt(category_id),
        meta_description: meta_description || '',
        meta_keywords: meta_keywords || '',
        is_published: is_published === '1' || is_published === 'true'
    };

    databaseModule.createBlogPost(postData, (err, postId) => {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                return res.json({ success: false, message: 'این slug قبلاً استفاده شده است' });
            }
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        // Process uploaded images
        let imageProcessingComplete = 0;
        const totalImagesToProcess = uploadedImages.length;

        if (totalImagesToProcess === 0) {
            // Process existing image placeholders in content
            processImagePlaceholders(postId, content, () => {
                res.json({ success: true, message: 'مقاله ایجاد شد', postId });
            });
        } else {
            // Process uploaded images first
            uploadedImages.forEach((image, index) => {
                const position = index + 1;
                const isMain = index === 0; // First uploaded image is main

                databaseModule.addBlogPostImage(postId, image.filename, image.originalname, isMain, (err) => {
                    if (err) {
                        console.error('Error adding image record:', err);
                    }

                    imageProcessingComplete++;
                    if (imageProcessingComplete === totalImagesToProcess) {
                        // Process existing image placeholders in content (but don't set them as main)
                        processImagePlaceholders(postId, content, () => {
                            // Ensure first image is set as main after all processing
                            setFirstImageAsMain(postId, () => {
                                res.json({ success: true, message: 'مقاله ایجاد شد', postId });
                            });
                        });
                    }
                });
            });
        }
    });
};

// Helper function to process image placeholders
function processImagePlaceholders(postId, content, callback) {
    const imageRegex = /\[IMAGE:([^\]]+)\]/g;
    let match;
    let placeholderCount = 0;
    let processedCount = 0;

    // Count placeholders first
    const matches = [...content.matchAll(imageRegex)];
    placeholderCount = matches.length;

    if (placeholderCount === 0) {
        return callback();
    }

    matches.forEach((match, index) => {
        const filename = match[1];

        // Skip placeholder/default images like panorama_1, panorama_2, etc.
        if (filename.startsWith('panorama_') && filename.match(/^panorama_\d+\.(jpg|jpeg|png|gif|webp)$/)) {
            console.log(`Skipping placeholder image: ${filename}`);
            processedCount++;
            if (processedCount === placeholderCount) {
                callback();
            }
            return;
        }

        const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
        const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

        if (fs.existsSync(storageImagePath) || fs.existsSync(oldImagePath)) {
            // Check if image already exists in database
            databaseModule.db.get(
                `SELECT id FROM blog_post_images WHERE post_id = ? AND filename = ?`,
                [postId, filename],
                (err, existing) => {
                    if (!existing) {
                        const position = index + 1;
                        // Only set as main if it's the first real uploaded image
                        const isMain = index === 0;
                        databaseModule.db.run(
                            `INSERT INTO blog_post_images (post_id, filename, original_name, is_main, position, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                            [postId, filename, filename, isMain ? 1 : 0, position],
                            (err) => {
                                if (err) {
                                    console.error('Error inserting image record:', err);
                                }
                                processedCount++;
                                if (processedCount === placeholderCount) {
                                    callback();
                                }
                            }
                        );
                    } else {
                        processedCount++;
                        if (processedCount === placeholderCount) {
                            callback();
                        }
                    }
                }
            );
        } else {
            console.log(`Image file not found: ${filename}`);
            processedCount++;
            if (processedCount === placeholderCount) {
                callback();
            }
        }
    });
}

// New helper function to ensure the first image is set as main
function setFirstImageAsMain(postId, callback) {
    // First reset all images to non-main
    databaseModule.db.run(`UPDATE blog_post_images SET is_main = 0 WHERE post_id = ?`, [postId], (err) => {
        if (err) {
            console.error('Error resetting is_main flags:', err);
            return callback();
        }

        // Find the first image by position (preferring lowest position, then creation date)
        databaseModule.db.get(
            `SELECT filename FROM blog_post_images WHERE post_id = ? ORDER BY position ASC, created_at ASC LIMIT 1`,
            [postId],
            (err, firstImage) => {
                if (err) {
                    console.error('Error finding first image:', err);
                    return callback();
                }

                if (!firstImage) {
                    console.log(`No remaining images found for post ${postId} - no main image to set`);
                    return callback();
                }

                // Set the first remaining image as main
                databaseModule.db.run(
                    `UPDATE blog_post_images SET is_main = 1 WHERE post_id = ? AND filename = ?`,
                    [postId, firstImage.filename],
                    (err) => {
                        if (err) {
                            console.error('Error setting first image as main:', err);
                        } else {
                            console.log(`✅ Set ${firstImage.filename} as new main image for post ${postId}`);
                        }
                        callback();
                    }
                );
            }
        );
    });
}


const adminUpdatePost = (req, res) => {
    const { id } = req.params;
    const { title, slug, content, excerpt, category_id, meta_description, meta_keywords, is_published } = req.body;
    const uploadedImages = req.files || [];

    // ابتدا مقاله موجود را دریافت کن
    databaseModule.getBlogPostById(id, (err, existingPost) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        if (!existingPost) {
            return res.status(404).json({ success: false, message: 'مقاله یافت نشد' });
        }

        // استفاده از مقادیر موجود اگر فیلدهای جدید ارسال نشده باشند
        const finalTitle = title || existingPost.title;
        const finalSlug = slug || existingPost.slug;
        const finalContent = content || existingPost.content;
        const finalCategoryId = category_id ? parseInt(category_id) : existingPost.category_id;

        // اعتبارسنجی فیلدهای نهایی
        if (!finalTitle || !finalSlug || !finalContent || !finalCategoryId) {
            return res.json({ success: false, message: 'عنوان، slug، محتوا و دسته‌بندی الزامی است' });
        }

        // تنظیم وضعیت انتشار
        let publishStatus;
        if (is_published !== undefined) {
            publishStatus = is_published === '1' || is_published === 'true' || is_published === true;
        } else {
            // اگر is_published ارسال نشده، مقدار فعلی را حفظ کن
            publishStatus = null;
        }

        const postData = {
            title: finalTitle,
            slug: finalSlug,
            content: finalContent,
            excerpt: excerpt !== undefined ? excerpt : existingPost.excerpt,
            category_id: finalCategoryId,
            meta_description: meta_description !== undefined ? meta_description : existingPost.meta_description,
            meta_keywords: meta_keywords !== undefined ? meta_keywords : existingPost.meta_keywords,
            is_published: publishStatus
        };

        databaseModule.updateBlogPost(id, postData, (err) => {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.json({ success: false, message: 'این slug قبلاً استفاده شده است' });
                }
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            // Process new image placeholders only if they don't exist in database
            const imageRegex = /\[IMAGE:([^\]]+)\]/g;
            const imagesToProcess = [];
            let match;

            // Collect all images from content
            while ((match = imageRegex.exec(finalContent)) !== null) {
                const filename = match[1];

                // Skip placeholder/default images
                if (filename.startsWith('panorama_') && filename.match(/^panorama_\d+\.(jpg|jpeg|png|gif|webp)$/)) {
                    console.log(`Skipping placeholder image in update: ${filename}`);
                    continue;
                }

                const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
                const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

                if (fs.existsSync(storageImagePath) || fs.existsSync(oldImagePath)) {
                    imagesToProcess.push(filename);
                }
            }

            // Process images only if they don't already exist
            if (imagesToProcess.length > 0) {
                let processedImages = 0;
                
                imagesToProcess.forEach(filename => {
                    databaseModule.db.get(
                        `SELECT id FROM blog_post_images WHERE post_id = ? AND filename = ?`,
                        [id, filename],
                        (err, existing) => {
                            if (!err && !existing) {
                                // Get current max position
                                databaseModule.db.get(
                                    `SELECT MAX(position) as maxPos FROM blog_post_images WHERE post_id = ?`,
                                    [id],
                                    (err, result) => {
                                        const nextPosition = (result && result.maxPos) ? result.maxPos + 1 : 1;
                                        
                                        databaseModule.db.run(
                                            `INSERT INTO blog_post_images (post_id, filename, original_name, is_main, position, created_at) VALUES (?, ?, ?, 0, ?, datetime('now'))`,
                                            [id, filename, filename, nextPosition],
                                            function(err) {
                                                if (err) {
                                                    console.error('Error inserting new image record in update:', err);
                                                }
                                                processedImages++;
                                                if (processedImages === imagesToProcess.length) {
                                                    // Ensure first image is main after all processing
                                                    setFirstImageAsMain(id, () => {});
                                                }
                                            }
                                        );
                                    }
                                );
                            } else {
                                processedImages++;
                                if (processedImages === imagesToProcess.length) {
                                    // Ensure first image is main after all processing
                                    setFirstImageAsMain(id, () => {});
                                }
                            }
                        }
                    );
                });
            }

            // After updating the post content and associated images, ensure the first image is the main one.
            // This handles cases where images are added or reordered in the content.
            setFirstImageAsMain(id, () => {
                res.json({ success: true, message: 'مقاله به‌روزرسانی شد' });
            });
        });
    });
};

const adminDeletePost = (req, res) => {
    const { id } = req.params;

    // First get post images to delete files
    databaseModule.getBlogPostImages(id, (err, images) => {
        if (!err && images) {
            // Delete image files - check both storage and old path
            images.forEach(image => {
                const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', image.filename);
                const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', image.filename);

                if (fs.existsSync(storageImagePath)) {
                    fs.unlinkSync(storageImagePath);
                } else if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            });
        }

        // Delete post from database (cascade will delete related data)
        databaseModule.deleteBlogPost(id, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }
            res.json({ success: true, message: 'مقاله حذف شد' });
        });
    });
};

// Image controllers
const adminGetImage = (req, res) => {
    const { filename } = req.params;

    // تشخیص مسیر فایل با چک کردن storage و uploads
    let imagePath;

    // اگر مسیر با storage شروع می‌شود، از مسیر اصلی استفاده کن
    const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
    const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

    if (fs.existsSync(storageImagePath)) {
        imagePath = storageImagePath;
    } else if (fs.existsSync(oldImagePath)) {
        imagePath = oldImagePath;
    } else {
        return res.status(404).send('تصویر یافت نشد');
    }

    res.sendFile(imagePath);
};

const adminDeleteImage = (req, res) => {
    const { filename } = req.params;

    // First get all posts that use this image to update their main image if needed
    databaseModule.db.all(
        `SELECT post_id, is_main FROM blog_post_images WHERE filename = ?`,
        [filename],
        (err, affectedPosts) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            // Delete physical file first - check both storage and old path
            const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
            const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

            // Always try to delete the physical file
            try {
                if (fs.existsSync(storageImagePath)) {
                    fs.unlinkSync(storageImagePath);
                    console.log(`Physical file deleted completely: ${storageImagePath}`);
                } else if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log(`Physical file deleted completely: ${oldImagePath}`);
                }
            } catch (fileError) {
                console.error('Error deleting physical file:', fileError);
            }

            // Delete from database (all instances)
            databaseModule.deleteBlogImageByFilename(filename, (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                // If any of the deleted images were main images, update those posts
                const postsNeedingMainUpdate = affectedPosts.filter(p => p.is_main);
                let updatesCompleted = 0;

                if (postsNeedingMainUpdate.length === 0) {
                    return res.json({ success: true, message: 'تصویر به طور کامل حذف شد' });
                }

                postsNeedingMainUpdate.forEach(post => {
                    setFirstImageAsMain(post.post_id, () => {
                        updatesCompleted++;
                        if (updatesCompleted === postsNeedingMainUpdate.length) {
                            res.json({ success: true, message: 'تصویر به طور کامل حذف شد و عکس‌های اصلی به‌روزرسانی شدند' });
                        }
                    });
                });
            });
        }
    );
};

// Related posts controllers with link type support
const adminGetRelatedPosts = (req, res) => {
    const { id } = req.params;

    databaseModule.getBlogRelatedPostsByType(id, (err, relatedPosts) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, relatedPosts: relatedPosts || { readMore: [], related: [] } });
    });
};

const adminSetRelatedPosts = (req, res) => {
    const { id } = req.params;
    const { relatedPosts } = req.body;

    if (!relatedPosts || typeof relatedPosts !== 'object') {
        return res.json({ success: false, message: 'داده مقالات مرتبط نامعتبر است' });
    }

    // Convert the structure to flat array with link types
    const flatRelatedPosts = [];

    if (relatedPosts.readMore && Array.isArray(relatedPosts.readMore)) {
        relatedPosts.readMore.forEach(postId => {
            flatRelatedPosts.push({ postId, linkType: 'read_more' });
        });
    }

    if (relatedPosts.related && Array.isArray(relatedPosts.related)) {
        relatedPosts.related.forEach(postId => {
            flatRelatedPosts.push({ postId, linkType: 'related' });
        });
    }

    databaseModule.setBlogRelatedPosts(id, flatRelatedPosts, (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, message: 'مقالات مرتبط به‌روزرسانی شد' });
    });
};

// Public API controllers
const getCategories = (req, res) => {
    databaseModule.getAllBlogCategories((err, categories) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, categories: categories || [] });
    });
};

// New function to get category by slug
const getCategoryBySlug = (req, res) => {
    const { categorySlug } = req.params;
    databaseModule.getBlogCategoryBySlug(categorySlug, (err, category) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        if (!category) {
            return res.status(404).json({ success: false, message: 'دسته‌بندی یافت نشد' });
        }
        res.json({ success: true, category });
    });
};


const getPosts = (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    databaseModule.getPublishedBlogPosts(parseInt(page), parseInt(limit), (err, posts, totalCount) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        res.json({ 
            success: true, 
            posts: posts || [], 
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount || 0,
                pages: Math.ceil((totalCount || 0) / parseInt(limit))
            }
        });
    });
};

const getPostsByCategory = (req, res) => {
    const { categorySlug } = req.params;
    const { page = 1, limit = 10 } = req.query;

    databaseModule.getPublishedBlogPostsByCategory(categorySlug, parseInt(page), parseInt(limit), (err, posts, totalCount) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }

        res.json({ 
            success: true, 
            posts: posts || [], 
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount || 0,
                pages: Math.ceil((totalCount || 0) / parseInt(limit))
            }
        });
    });
};

const getPost = (req, res) => {
    const { categorySlug, postSlug } = req.params;
    databaseModule.getPublishedBlogPost(categorySlug, postSlug, (err, post) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        if (!post) {
            return res.status(404).json({ success: false, message: 'مقاله یافت نشد' });
        }

        // Get post images with position
        databaseModule.getBlogPostImagesWithPosition(post.id, (err, images) => {
            if (err) {
                console.error('خطا در دریافت تصاویر:', err);
                images = [];
            }

            // Process content with proper image handling
            let processedContent = post.content;

            // Replace image placeholders with proper markdown including position data
            if (images && images.length > 0) {
                images.forEach(image => {
                    const placeholder = `[IMAGE:${image.filename}]`;
                    // Create SEO-friendly alt text from original name or filename
                    const altText = image.original_name ? 
                        image.original_name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ') : 
                        image.filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
                    const imageMarkdown = `![${altText}](/api/blog/images/${image.filename} "${altText}")`;
                    // Escape special regex characters in filename
                    const escapedFilename = image.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    processedContent = processedContent.replace(new RegExp(`\\[IMAGE:${escapedFilename}\\]`, 'g'), imageMarkdown);
                });
            }

            // Convert markdown to HTML
            let htmlContent = marked.parse(processedContent);

            // Enhanced image styling with better responsive design
            htmlContent = htmlContent.replace(/<p><img\s+([^>]*?)><\/p>/g, (match, imgAttrs) => {
                return `<div class="blog-image-container" style="text-align: center; margin: 2rem 0; padding: 1rem;">
    <figure class="blog-image-figure" style="margin: 0; display: inline-block; max-width: 100%;">
        <img ${imgAttrs} loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer;" onclick="this.style.transform = this.style.transform ? '' : 'scale(1.05)'; this.style.boxShadow = this.style.boxShadow.includes('0.2') ? '0 8px 32px rgba(0,0,0,0.12)' : '0 12px 48px rgba(0,0,0,0.2)';">
    </figure>
</div>`;
            });

            // Handle standalone img tags
            htmlContent = htmlContent.replace(/<img\s+([^>]*?)(?<!<figure[^>]*>.*?)>/g, (match, imgAttrs) => {
                return `<div class="blog-image-container" style="text-align: center; margin: 2rem 0; padding: 1rem;">
    <figure class="blog-image-figure" style="margin: 0; display: inline-block; max-width: 100%;">
        <img ${imgAttrs} loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer;" onclick="this.style.transform = this.style.transform ? '' : 'scale(1.05)'; this.style.boxShadow = this.style.boxShadow.includes('0.2') ? '0 8px 32px rgba(0,0,0,0.12)' : '0 12px 48px rgba(0,0,0,0.2)';">
    </figure>
</div>`;
            });

            // Clean up any extra paragraph tags around image containers
            htmlContent = htmlContent.replace(/<p>\s*(<div class="blog-image-container">[\s\S]*?<\/div>)\s*<\/p>/g, '$1');

            // Get main image for SEO and social sharing
            const mainImage = images.find(img => img.is_main) || images[0];

            // Get related posts
            databaseModule.getBlogRelatedPostsByType(post.id, (err, relatedPosts) => {
                if (err) {
                    console.error('خطا در دریافت مقالات مرتبط:', err);
                    relatedPosts = { readMore: [], related: [] };
                }

                res.json({ 
                    success: true, 
                    post: {
                        ...post,
                        images: images || [],
                        main_image: mainImage ? `/api/blog/images/${mainImage.filename}` : null,
                        content_html: htmlContent,
                        relatedPosts: relatedPosts || { readMore: [], related: [] }
                    }
                });
            });
        });
    });
};

const getRelatedPosts = (req, res) => {
    const { id } = req.params;

    databaseModule.getBlogRelatedPostsByType(id, (err, relatedPosts) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'خطای سیستم' });
        }
        res.json({ success: true, relatedPosts: relatedPosts || { readMore: [], related: [] } });
    });
};

const getImage = (req, res) => {
    const { filename } = req.params;

    // تشخیص مسیر فایل با چک کردن storage و uploads
    let imagePath;

    // اگر مسیر با storage شروع می‌شود، از مسیر اصلی استفاده کن
    const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
    const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

    if (fs.existsSync(storageImagePath)) {
        imagePath = storageImagePath;
    } else if (fs.existsSync(oldImagePath)) {
        imagePath = oldImagePath;
    } else {
        return res.status(404).send('تصویر یافت نشد');
    }

    // Get file stats for ETag and last-modified
    const stats = fs.statSync(imagePath);
    const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
    const lastModified = stats.mtime.toUTCString();

    // Check if client has cached version
    const clientETag = req.headers['if-none-match'];
    const clientLastModified = req.headers['if-modified-since'];

    if (clientETag === etag || (clientLastModified && new Date(clientLastModified) >= stats.mtime)) {
        return res.status(304).end();
    }

    // Set cache headers for better performance (1 year for images)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);

    // Set proper content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    };

    if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
    }

    res.sendFile(imagePath);
};

// New controllers for enhanced image management
const adminDeletePostImage = (req, res) => {
    const { id, filename } = req.params;

    // First check if this image is the main image
    databaseModule.db.get(
        `SELECT is_main FROM blog_post_images WHERE post_id = ? AND filename = ?`,
        [id, filename],
        (err, imageInfo) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'خطای سیستم' });
            }

            // Delete physical file first - check both storage and old path
            const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
            const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

            // Always try to delete the physical file
            try {
                if (fs.existsSync(storageImagePath)) {
                    fs.unlinkSync(storageImagePath);
                    console.log(`Physical file deleted: ${storageImagePath}`);
                } else if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log(`Physical file deleted: ${oldImagePath}`);
                }
            } catch (fileError) {
                console.error('Error deleting physical file:', fileError);
            }

            // Delete the image from database
            databaseModule.deleteBlogPostImage(id, filename, (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'خطای سیستم' });
                }

                // If the deleted image was main image, set the first remaining image as main
                if (imageInfo && imageInfo.is_main) {
                    setFirstImageAsMain(id, () => {
                        res.json({ success: true, message: 'تصویر اصلی حذف شد و عکس اصلی جدید تنظیم شد' });
                    });
                } else {
                    res.json({ success: true, message: 'تصویر حذف شد' });
                }
            });
        }
    );
};

const adminUpdateImagePositions = (req, res) => {
    const { id } = req.params;
    const { positions } = req.body; // Array of {filename, position}

    if (!Array.isArray(positions)) {
        return res.json({ success: false, message: 'داده‌های موقعیت تصاویر نامعتبر است' });
    }

    const updatePromises = positions.map(item => {
        return new Promise((resolve) => {
            databaseModule.updateBlogImagePosition(id, item.filename, item.position, resolve);
        });
    });

    Promise.all(updatePromises).then(() => {
        res.json({ success: true, message: 'موقعیت تصاویر به‌روزرسانی شد' });
    }).catch(() => {
        res.status(500).json({ success: false, message: ' خطا در به‌روزرسانی موقعیت تصاویر' });
    });
};

const adminUploadSingleImage = async (req, res) => {
    const uploadedImage = req.file;

    if (!uploadedImage) {
        return res.json({ success: false, message: 'هیچ تصویری آپلود نشد' });
    }

    try {
        // Optimize the uploaded image
        const originalPath = uploadedImage.path;
        const tempOptimizedPath = originalPath + '.optimized';

        const optimizationResult = await optimizeImage(originalPath, tempOptimizedPath, uploadedImage.filename);

        // Replace original with optimized version
        if (optimizationResult.success) {
            fs.renameSync(tempOptimizedPath, originalPath);
        }

        res.json({ 
            success: true, 
            message: 'تصویر آپلود و بهینه‌سازی شد',
            filename: uploadedImage.filename,
            originalName: uploadedImage.originalname,
            url: `/api/blog/images/${uploadedImage.filename}`,
            optimization: optimizationResult
        });
    } catch (error) {
        console.error('❌ Image upload optimization error:', error);
        res.json({ 
            success: true, 
            message: 'تصویر آپلود شد (بدون بهینه‌سازی)',
            filename: uploadedImage.filename,
            originalName: uploadedImage.originalname,
            url: `/api/blog/images/${uploadedImage.filename}`
        });
    }
};

const adminUploadCustomNameImage = async (req, res) => {
    const uploadedImage = req.file;
    const customFileName = req.body.customFileName;

    if (!uploadedImage) {
        return res.json({ success: false, message: 'هیچ تصویری آپلود نشد' });
    }

    try {
        // Optimize the uploaded image
        const originalPath = uploadedImage.path;
        const tempOptimizedPath = originalPath + '.optimized';

        const optimizationResult = await optimizeImage(originalPath, tempOptimizedPath, uploadedImage.filename);

        // Replace original with optimized version
        if (optimizationResult.success) {
            fs.renameSync(tempOptimizedPath, originalPath);
        }

        // The filename is already processed by multer with custom name logic
        res.json({ 
            success: true, 
            message: 'تصویر با نام دلخواه آپلود و بهینه‌سازی شد',
            filename: uploadedImage.filename,
            originalName: uploadedImage.originalname,
            customName: customFileName || 'نام خودکار',
            url: `/api/blog/images/${uploadedImage.filename}`,
            preview: `/api/blog/images/${uploadedImage.filename}`,
            size: uploadedImage.size,
            mimetype: uploadedImage.mimetype,
            optimization: optimizationResult
        });
    } catch (error) {
        console.error('❌ Custom image upload optimization error:', error);
        res.json({ 
            success: true, 
            message: 'تصویر با نام دلخواه آپلود شد (بدون بهینه‌سازی)',
            filename: uploadedImage.filename,
            originalName: uploadedImage.originalname,
            customName: customFileName || 'نام خودکار',
            url: `/api/blog/images/${uploadedImage.filename}`,
            preview: `/api/blog/images/${uploadedImage.filename}`,
            size: uploadedImage.size,
            mimetype: uploadedImage.mimetype
        });
    }
};

const adminRenameImage = async (req, res) => {
    const { filename } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
        return res.json({ success: false, message: 'نام جدید الزامی است' });
    }

    try {
        // Find the image file (check both storage and old path)
        const storageImagePath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images', filename);
        const oldImagePath = path.join(process.cwd(), 'blog/uploads/images', filename);

        let currentPath;
        if (fs.existsSync(storageImagePath)) {
            currentPath = storageImagePath;
        } else if (fs.existsSync(oldImagePath)) {
            currentPath = oldImagePath;
        } else {
            return res.status(404).json({ success: false, message: 'فایل یافت نشد' });
        }

        // Get file extension
        const ext = path.extname(filename);
        
        // Clean and sanitize new name
        const cleanName = newName.trim().replace(/[^\u0600-\u06FF\w\s-]/g, '').replace(/\s+/g, '-');
        if (!cleanName) {
            return res.json({ success: false, message: 'نام نامعتبر است' });
        }

        // Generate unique filename with extension
        const baseDir = path.dirname(currentPath);
        let newFilename = cleanName + ext;
        let counter = 1;

        // Check for duplicates and add number if needed
        while (fs.existsSync(path.join(baseDir, newFilename))) {
            newFilename = `${cleanName}-${counter}${ext}`;
            counter++;
        }

        const newPath = path.join(baseDir, newFilename);

        // Read, optimize and save with new name
        const imageBuffer = fs.readFileSync(currentPath);
        const tempOptimizedPath = newPath + '.temp';

        try {
            const optimizationResult = await optimizeImage(currentPath, tempOptimizedPath, newFilename);
            
            if (optimizationResult.success && fs.existsSync(tempOptimizedPath)) {
                // Use optimized version
                fs.renameSync(tempOptimizedPath, newPath);
            } else {
                // Use original if optimization failed
                fs.copyFileSync(currentPath, newPath);
            }

            // Delete original file
            fs.unlinkSync(currentPath);

            // Update database records
            databaseModule.db.run(
                `UPDATE blog_post_images SET filename = ? WHERE filename = ?`,
                [newFilename, filename],
                function(err) {
                    if (err) {
                        console.error('خطا در به‌روزرسانی دیتابیس:', err);
                        // Restore original file if database update failed
                        fs.renameSync(newPath, currentPath);
                        return res.status(500).json({ success: false, message: 'خطا در به‌روزرسانی دیتابیس' });
                    }

                    res.json({
                        success: true,
                        message: 'نام فایل با موفقیت تغییر یافت',
                        oldFilename: filename,
                        newFilename: newFilename,
                        url: `/api/blog/images/${newFilename}`,
                        optimized: optimizationResult.success || false
                    });
                }
            );

        } catch (optimizationError) {
            console.error('خطا در بهینه‌سازی:', optimizationError);
            // Fallback to simple copy without optimization
            fs.copyFileSync(currentPath, newPath);
            fs.unlinkSync(currentPath);

            // Update database
            databaseModule.db.run(
                `UPDATE blog_post_images SET filename = ? WHERE filename = ?`,
                [newFilename, filename],
                function(err) {
                    if (err) {
                        console.error('خطا در به‌روزرسانی دیتابیس:', err);
                        fs.renameSync(newPath, currentPath);
                        return res.status(500).json({ success: false, message: 'خطا در به‌روزرسانی دیتابیس' });
                    }

                    res.json({
                        success: true,
                        message: 'نام فایل تغییر یافت (بدون بهینه‌سازی)',
                        oldFilename: filename,
                        newFilename: newFilename,
                        url: `/api/blog/images/${newFilename}`,
                        optimized: false
                    });
                }
            );
        }

    } catch (error) {
        console.error('خطا در تغییر نام فایل:', error);
        res.status(500).json({ success: false, message: 'خطای سیستم' });
    }
};

// New controller to get all images with thumbnails
const adminGetAllImages = (req, res) => {
    const storageUploadsPath = path.join(process.cwd(), 'storage', 'uploads', 'blog_images');
    const oldUploadsPath = path.join(process.cwd(), 'blog/uploads/images');

    let imageList = [];

    // Read from storage path
    if (fs.existsSync(storageUploadsPath)) {
        try {
            const storageFiles = fs.readdirSync(storageUploadsPath);
            const storageImageFiles = storageFiles.filter(file => {
                return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            });

            storageImageFiles.forEach(filename => {
                const filePath = path.join(storageUploadsPath, filename);
                const stats = fs.statSync(filePath);

                imageList.push({
                    filename,
                    url: `/api/blog/images/${filename}`,
                    preview: `/api/blog/images/${filename}`,
                    size: stats.size,
                    modified: stats.mtime,
                    markdown: `![تصویر](/api/blog/images/${filename})`,
                    location: 'storage'
                });
            });
        } catch (err) {
            console.error('Error reading storage images:', err);
        }
    }

    // Read from old path
    if (fs.existsSync(oldUploadsPath)) {
        try {
            const oldFiles = fs.readdirSync(oldUploadsPath);
            const oldImageFiles = oldFiles.filter(file => {
                return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
            });

            oldImageFiles.forEach(filename => {
                // Only add if not already in storage list
                if (!imageList.find(img => img.filename === filename)) {
                    const filePath = path.join(oldUploadsPath, filename);
                    const stats = fs.statSync(filePath);

                    imageList.push({
                        filename,
                        url: `/api/blog/images/${filename}`,
                        preview: `/api/blog/images/${filename}`,
                        size: stats.size,
                        modified: stats.mtime,
                        markdown: `![تصویر](/api/blog/images/${filename})`,
                        location: 'old'
                    });
                }
            });
        } catch (err) {
            console.error('Error reading old images:', err);
        }
    }

    // Sort by modification time (newest first)
    imageList.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json({ 
        success: true, 
        images: imageList,
        total: imageList.length
    });
};

// ===========================================
// Server-Side Rendering (SSR) Controllers
// ===========================================

// SSR Blog Index Controller
const ssrBlogIndex = (req, res) => {
    const { page = 1 } = req.query;
    const limit = 9;

    // First get categories
    databaseModule.getAllBlogCategories((err, categories) => {
        if (err) {
            console.error('Error getting categories for SSR:', err);
            // Fallback to static HTML if error
            return res.sendFile(path.join(__dirname, 'public', 'blog-index.html'));
        }

        // Then get posts with pagination
        databaseModule.getPublishedBlogPosts(parseInt(page), limit, (err, posts, totalCount) => {
            if (err) {
                console.error('Error getting posts for SSR:', err);
                // Fallback to static HTML if error
                return res.sendFile(path.join(__dirname, 'public', 'blog-index.html'));
            }

            const pagination = {
                page: parseInt(page),
                limit: limit,
                total: totalCount || 0,
                pages: Math.ceil((totalCount || 0) / limit)
            };

            try {
                const renderedHTML = ssrUtils.renderBlogIndex(categories || [], posts || [], pagination, req);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(renderedHTML);
            } catch (renderError) {
                console.error('Error rendering blog index:', renderError);
                // Fallback to static HTML if render error
                res.sendFile(path.join(__dirname, 'public', 'blog-index.html'));
            }
        });
    });
};

// SSR Blog Category Controller
const ssrBlogCategory = (req, res) => {
    const { slug } = req.params;
    const { page = 1 } = req.query;
    const limit = 9;

    // First get the category
    databaseModule.getBlogCategoryBySlug(slug, (err, category) => {
        if (err || !category) {
            console.error('Category not found for SSR:', slug, err);
            return res.status(404).sendFile(path.join(__dirname, 'public', 'blog-category.html'));
        }

        // Get all categories for navigation
        databaseModule.getAllBlogCategories((err, categories) => {
            if (err) {
                console.error('Error getting categories for SSR:', err);
                return res.status(500).sendFile(path.join(__dirname, 'public', 'blog-category.html'));
            }

            // Get posts for this category
            databaseModule.getPublishedBlogPostsByCategory(slug, parseInt(page), limit, (err, posts, totalCount) => {
                if (err) {
                    console.error('Error getting category posts for SSR:', err);
                    return res.status(500).sendFile(path.join(__dirname, 'public', 'blog-category.html'));
                }

                const pagination = {
                    page: parseInt(page),
                    limit: limit,
                    total: totalCount || 0,
                    pages: Math.ceil((totalCount || 0) / limit)
                };

                try {
                    const renderedHTML = ssrUtils.renderBlogCategory(category, categories || [], posts || [], pagination, req);
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.send(renderedHTML);
                } catch (renderError) {
                    console.error('Error rendering blog category:', renderError);
                    res.sendFile(path.join(__dirname, 'public', 'blog-category.html'));
                }
            });
        });
    });
};

// SSR Blog Post Controller
const ssrBlogPost = (req, res) => {
    const { category: categorySlug, slug: postSlug } = req.params;

    // Get the post
    databaseModule.getPublishedBlogPost(categorySlug, postSlug, (err, post) => {
        if (err || !post) {
            console.error('Post not found for SSR:', categorySlug, postSlug, err);
            return res.status(404).sendFile(path.join(__dirname, 'public', 'blog-post.html'));
        }

        // Process markdown content to HTML if needed
        if (post.content && !post.content_html) {
            post.content_html = marked.parse(post.content);
        }

        // Get related posts
        databaseModule.getBlogRelatedPostsByType(post.id, (err, relatedPosts) => {
            if (err) {
                console.error('Error getting related posts for SSR:', err);
                relatedPosts = { readMore: [], related: [] };
            }

            try {
                const renderedHTML = ssrUtils.renderBlogPost(post, relatedPosts || { readMore: [], related: [] }, req);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(renderedHTML);
            } catch (renderError) {
                console.error('Error rendering blog post:', renderError);
                res.sendFile(path.join(__dirname, 'public', 'blog-post.html'));
            }
        });
    });
};

module.exports = {
    adminLogin,
    adminLogout,
    adminGetCategories,
    adminCreateCategory,
    adminUpdateCategory,
    adminDeleteCategory,
    adminGetPosts,
    adminGetPost,
    adminCreatePost,
    adminUpdatePost,
    adminDeletePost,
    adminGetImage,
    adminDeleteImage,
    adminDeletePostImage,
    adminUpdateImagePositions,
    adminUploadSingleImage,
    adminUploadCustomNameImage,
    adminRenameImage,
    adminGetAllImages,
    adminGetRelatedPosts,
    adminSetRelatedPosts,
    getCategories,
    getPosts,
    getPostsByCategory,
    getPost,
    getRelatedPosts,
    getImage,
    getCategoryBySlug,
    // SSR Controllers
    ssrBlogIndex,
    ssrBlogCategory,
    ssrBlogPost
};