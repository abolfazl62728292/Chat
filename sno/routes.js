const express = require('express');
const path = require('path');
const router = express.Router();

// Serve static files for sno public assets
router.use('/assets', express.static(path.join(__dirname, 'public')));

// Redirect to main login with return parameter for sno
router.get('/login', (req, res) => {
    res.redirect('/login?return=/sno/panel');
});

// User panel route - requires authentication
router.get('/panel', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    // Extend session on activity
    req.session.touch();
    
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Settings page route - requires authentication
router.get('/settings', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    // Extend session on activity
    req.session.touch();
    
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

module.exports = router;