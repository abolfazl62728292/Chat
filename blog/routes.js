
const express = require('express');
const path = require('path');
const BlogAdminAuth = require('./admin-auth');
const controllers = require('./controllers');

const router = express.Router();

// Serve static files FIRST - before any dynamic routes
// This matches the paths used in HTML files like /blog/public/blog-index.css
router.use('/public', express.static(path.join(__dirname, 'public')));

// Also serve from /assets for alternative access
router.use('/assets', express.static(path.join(__dirname, 'public')));

// Blog admin login page
router.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Blog admin panel (protected route)
router.get('/admin', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

// Category management pages
router.get('/admin/categories', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-categories.html'));
});

// Post creation and editing pages
router.get('/admin/posts', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-posts.html'));
});

router.get('/admin/posts/new', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'enhanced-post-editor.html'));
});

router.get('/admin/posts/edit/:id', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'enhanced-post-editor.html'));
});

// Image management page
router.get('/admin/images', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-images.html'));
});

// Legacy editor routes (keep old editor accessible)
router.get('/admin/posts/new-legacy', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-post-editor.html'));
});

router.get('/admin/posts/edit-legacy/:id', BlogAdminAuth.requireAdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-post-editor.html'));
});

// Public blog routes - using SSR for dynamic meta tags
// These come AFTER static routes to prevent conflicts
router.get('/', controllers.ssrBlogIndex);

router.get('/category/:slug', controllers.ssrBlogCategory);

router.get('/:category/:slug', controllers.ssrBlogPost);

module.exports = router;
