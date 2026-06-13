const express = require('express');
const router = express.Router();

// TODO: List alerts
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Alerts list placeholder' });
});

// TODO: Update alert status (e.g., acknowledge/close)
router.patch('/:id/status', (req, res) => {
  res.status(200).json({ message: 'Alert status update placeholder' });
});

module.exports = router;
