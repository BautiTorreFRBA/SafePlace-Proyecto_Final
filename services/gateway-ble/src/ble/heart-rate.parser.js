// Placeholder to parse the raw BLE buffer into heart rate
function parseHeartRate(buffer) {
  // TODO: Implement parsing according to Bluetooth specification for Heart Rate Measurement
  return {
    heartRate: 0,
    timestamp: new Date().toISOString()
  };
}

module.exports = { parseHeartRate };
