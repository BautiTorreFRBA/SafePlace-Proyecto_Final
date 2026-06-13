// Placeholder for Gateway Device Token Authentication
function verifyDeviceToken(req, res, next) {
  const token = req.headers['x-device-token'];
  // TODO: validate against DEVICE_TOKEN_SECRET
  if (!token || token !== process.env.DEVICE_TOKEN_SECRET) {
    return res.status(401).json({ error: 'Invalid device token' });
  }
  next();
}

module.exports = verifyDeviceToken;
