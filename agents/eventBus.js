const EventEmitter = require('events');

// Shared event bus for inter-agent communication
// All agents publish and subscribe to events through this single bus

const eventBus = new EventEmitter();
eventBus.setMaxListeners(20); // Allow multiple agents to subscribe

// Debug: log all events in development
eventBus.on('newListener', function(event) {
  console.log('[EventBus] Agent subscribed to:', event);
});

module.exports = eventBus;
//EventEmitter is a built-in Node.js class that has two methods:
//.emit(eventName, data) — broadcast a message
//.on(eventName, callback) — listen for that message