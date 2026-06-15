const VALID_ROLES = ['admin', 'supervisor', 'operator'];

function validate(data) {
  if (!data.email || !data.password) {
    throw new Error('email and password are required');
  }
  if (data.role && !VALID_ROLES.includes(data.role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
}

module.exports = { validate, VALID_ROLES };
