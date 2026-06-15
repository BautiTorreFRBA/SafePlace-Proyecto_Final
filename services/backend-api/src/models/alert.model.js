const VALID_STATUSES = ['open', 'acknowledged', 'closed'];

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
}

module.exports = { validateStatus, VALID_STATUSES };
