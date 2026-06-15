const REQUIRED_FIELDS = ['name', 'mac_address'];

function validate(data) {
  const missing = REQUIRED_FIELDS.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

module.exports = { validate };
