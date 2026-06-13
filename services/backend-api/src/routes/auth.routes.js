const express = require('express');
const router = express.Router();

// TODO: Link to auth controller
router.post('/login', (req, res) => {
  res.status(200).json({ message: 'Login placeholder' });
});

module.exports = router;
