const axios = require('axios');
const queue = require('./queue');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1/mediciones';
const API_KEY = process.env.GATEWAY_API_KEY || 'default-gateway-secret';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const despacharItem = async (item, retryCount = 0) => {
  try {
    await axios.post(API_URL, item, {
      headers: {
        'x-device-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    console.log('Item despachado con éxito.');
  } catch (error) {
    const maxRetries = 5;
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      console.warn(`Error al despachar. Reintentando en ${delay / 1000}s... (Intento ${retryCount + 1}/${maxRetries})`);
      await wait(delay);
      return despacharItem(item, retryCount + 1);
    } else {
      console.error('Máximo de reintentos alcanzado. Retornando el item a la cola principal.');
      queue.requeue(item);
    }
  }
};

const processQueue = async () => {
  if (!queue.isEmpty()) {
    const item = queue.dequeue();
    await despacharItem(item);
  }
  
  // Procesar el siguiente item después de una breve pausa
  setTimeout(processQueue, 1000);
};

// Iniciar el procesamiento
processQueue();

module.exports = {
  processQueue,
};
