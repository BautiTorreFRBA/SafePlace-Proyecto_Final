(() => {
  if (window.__SAFEPLACE_API_URL__) return;

  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  window.__SAFEPLACE_API_URL__ = isLocalHost
    ? 'http://localhost:8000/api/v1'
    : 'https://safeplace-backend-9vhx.onrender.com/api/v1';
})();
