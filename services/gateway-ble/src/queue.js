const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'queue.json');

class ResilientQueue {
  constructor() {
    this.queue = [];
    this._loadQueue();
  }

  _loadQueue() {
    if (fs.existsSync(QUEUE_FILE)) {
      try {
        const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
        this.queue = JSON.parse(data);
      } catch (error) {
        console.error('Error al cargar la cola local:', error);
        this.queue = [];
      }
    }
  }

  _saveQueue() {
    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error al persistir la cola local:', error);
    }
  }

  enqueue(item) {
    this.queue.push(item);
    this._saveQueue();
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const item = this.queue.shift();
    this._saveQueue();
    return item;
  }

  requeue(item) {
    this.queue.unshift(item); // Pone el item de vuelta al principio
    this._saveQueue();
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = new ResilientQueue();
