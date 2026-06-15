const REQUIRED_FIELDS = ['worker_id', 'heart_rate', 'timestamp'];

function validate(data) {
  const missing = REQUIRED_FIELDS.filter((f) => data[f] == null);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  if (data.heart_rate < 0 || data.heart_rate > 300) {
    throw new Error('heart_rate out of valid range (0-300)');
  }
}

module.exports = { validate };
