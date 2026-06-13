// Placeholder for Garmin specific connection and data reading
class GarminClient {
  constructor(deviceAddress) {
    this.address = deviceAddress;
  }

  connect() {
    // TODO: Connect to GATT server
  }

  subscribeToHeartRate() {
    // TODO: Subscribe to HRS characteristic
  }
}

module.exports = GarminClient;
