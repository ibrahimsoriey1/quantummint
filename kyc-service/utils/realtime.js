let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function emitKycUpdate(payload) {
  if (ioInstance) ioInstance.emit('kyc:update', payload);
}

module.exports = { setIO, emitKycUpdate };


