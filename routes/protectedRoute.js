// routes/protectedRoute.js
const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/admin', auth, auth.checkRole('admin'), (req, res) => {
    res.send('Admin content');
});

module.exports = router;
