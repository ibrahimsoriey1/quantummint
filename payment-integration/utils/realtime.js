let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function emitPaymentUpdate(payload) {
  if (ioInstance) {
    ioInstance.emit('payment:update', payload);
  }
}

module.exports = { setIO, emitPaymentUpdate };


