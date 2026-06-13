// Placeholder for HTTP client to send data to Backend API
const axios = require('axios');

class BackendClient {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'x-device-token': token,
        'Content-Type': 'application/json'
      }
    });
  }

  async sendMeasurement(data) {
    // TODO: send POST request to /measurements
    // return this.client.post('/measurements', data);
  }
}

module.exports = BackendClient;
