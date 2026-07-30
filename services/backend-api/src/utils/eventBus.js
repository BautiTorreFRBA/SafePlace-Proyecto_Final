const { EventEmitter } = require('events');

// Bus de eventos en memoria para el push de notificaciones (H0015 vía SSE).
// Alcance: un único proceso — alcanza para el despliegue actual (una sola
// instancia de Render). Si en el futuro se escala a más de una instancia,
// esto necesita un pub/sub externo (Redis, etc.) en vez de EventEmitter.
const bus = new EventEmitter();
bus.setMaxListeners(0);

module.exports = bus;
