const deviceAuth = (req, res, next) => {
  try {
    const apiKey = req.headers['x-device-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Acceso de dispositivo denegado. API Key no proporcionada.' });
    }

    // Verificar si la API Key coincide con la configurada en el entorno
    if (apiKey !== process.env.GATEWAY_API_KEY) {
      return res.status(403).json({ error: 'API Key de dispositivo inválida.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error interno validando el dispositivo.' });
  }
};

module.exports = deviceAuth;
