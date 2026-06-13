const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Devices list placeholder' });
});

router.post('/', (req, res) => {
  res.status(201).json({ message: 'Device creation placeholder' });
});

module.exports = router;
