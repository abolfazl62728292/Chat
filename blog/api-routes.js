const express = require('express');
const router = express.Router();
const BlogAdminAuth = require('./admin-auth');
const controllers = require('./controllers');
const { upload } = require('./config');

// Admin authentication routes
router.post('/admin/login', controllers.adminLogin);
router.post('/admin/logout', controllers.adminLogout);

// Category management routes (admin only)
router.get('/admin/categories', BlogAdminAuth.requireAdminAuth, controllers.adminGetCategories);
router.post('/admin/categories', BlogAdminAuth.requireAdminAuth, controllers.adminCreateCategory);
router.put('/admin/categories/:id', BlogAdminAuth.requireAdminAuth, controllers.adminUpdateCategory);
router.delete('/admin/categories/:id', BlogAdminAuth.requireAdminAuth, controllers.adminDeleteCategory);

// Post management routes (admin only)
router.get('/admin/posts', BlogAdminAuth.requireAdminAuth, controllers.adminGetPosts);
router.get('/admin/posts/:id', BlogAdminAuth.requireAdminAuth, controllers.adminGetPost);
router.post('/admin/posts', BlogAdminAuth.requireAdminAuth, upload.array('images', 20), controllers.adminCreatePost);
router.put('/admin/posts/:id', BlogAdminAuth.requireAdminAuth, upload.array('images', 20), controllers.adminUpdatePost);
router.delete('/admin/posts/:id', BlogAdminAuth.requireAdminAuth, controllers.adminDeletePost);

// Image management routes (admin only)
router.get('/admin/images', BlogAdminAuth.requireAdminAuth, controllers.adminGetAllImages);
router.get('/admin/images/:filename', BlogAdminAuth.requireAdminAuth, controllers.adminGetImage);
router.delete('/admin/images/:filename', BlogAdminAuth.requireAdminAuth, controllers.adminDeleteImage);
router.delete('/admin/posts/:id/images/:filename', BlogAdminAuth.requireAdminAuth, controllers.adminDeletePostImage);
router.put('/admin/posts/:id/images/positions', BlogAdminAuth.requireAdminAuth, controllers.adminUpdateImagePositions);
router.post('/admin/upload-single-image', BlogAdminAuth.requireAdminAuth, upload.single('image'), controllers.adminUploadSingleImage);
router.post('/admin/upload-custom-name-image', BlogAdminAuth.requireAdminAuth, upload.single('image'), controllers.adminUploadCustomNameImage);
router.put('/admin/images/:filename/rename', BlogAdminAuth.requireAdminAuth, controllers.adminRenameImage);

// Related posts management (admin only)
router.get('/admin/posts/:id/related', BlogAdminAuth.requireAdminAuth, controllers.adminGetRelatedPosts);
router.post('/admin/posts/:id/related', BlogAdminAuth.requireAdminAuth, controllers.adminSetRelatedPosts);

// Public API routes
router.get('/categories', controllers.getCategories);
router.get('/categories/:categorySlug', controllers.getCategoryBySlug);
router.get('/posts', controllers.getPosts);
router.get('/posts/category/:categorySlug', controllers.getPostsByCategory);
router.get('/posts/:categorySlug/:postSlug', controllers.getPost);
router.get('/posts/:id/related', controllers.getRelatedPosts);

// Image serving for public
router.get('/images/:filename', controllers.getImage);

module.exports = router;