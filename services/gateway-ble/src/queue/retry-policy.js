// Placeholder for retry policy (e.g., exponential backoff)
function getRetryDelay(attempt) {
  const baseDelay = 1000;
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // max 30s
}

module.exports = { getRetryDelay };
