const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth"); 
const { requireRole } = require("../middleware/role");  


router.get('/admin/dashboard', authenticateToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Welcome Admin!' });
});

module.exports = router;
