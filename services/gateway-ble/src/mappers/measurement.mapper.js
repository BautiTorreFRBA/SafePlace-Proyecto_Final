// Placeholder to map internal BLE data to API JSON schema
function mapToMeasurementDTO(deviceData, gatewayId) {
  return {
    gatewayId,
    deviceId: deviceData.deviceId,
    heartRate: deviceData.heartRate,
    activityLevel: deviceData.activityLevel || 'unknown',
    inactivitySeconds: deviceData.inactivitySeconds || 0,
    timestamp: deviceData.timestamp
  };
}

module.exports = { mapToMeasurementDTO };
