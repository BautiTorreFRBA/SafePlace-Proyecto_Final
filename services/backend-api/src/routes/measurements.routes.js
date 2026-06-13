const express = require('express');
const router = express.Router();

// TODO: Implement measurement ingestion (needs deviceToken middleware)
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Measurement ingested placeholder' });
});

// TODO: Implement historical data fetching
router.get('/:id_trabajador', (req, res) => {
  res.status(200).json({ message: 'Measurement history placeholder' });
});

module.exports = router;
