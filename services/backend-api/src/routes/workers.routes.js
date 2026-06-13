const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Workers list placeholder' });
});

router.post('/', (req, res) => {
  res.status(201).json({ message: 'Worker creation placeholder' });
});

module.exports = router;
