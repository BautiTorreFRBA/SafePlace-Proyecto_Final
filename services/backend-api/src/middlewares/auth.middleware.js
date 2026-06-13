// Placeholder for JWT verification
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  // TODO: implement actual verification logic
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  // Mock verification
  req.user = { id: 1, role: 'Supervisor' };
  next();
}

module.exports = verifyToken;
