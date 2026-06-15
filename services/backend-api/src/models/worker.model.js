// Defines the shape of a Worker entity and basic validation
const REQUIRED_FIELDS = ['nombre', 'apellido', 'dni', 'area'];

function validate(data) {
  const missing = REQUIRED_FIELDS.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

module.exports = { validate };
