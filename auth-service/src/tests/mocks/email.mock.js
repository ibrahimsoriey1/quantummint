// Mock for nodemailer
const mockSendMailFunction = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    messageId: 'mock-message-id',
    response: '250 OK',
  });
});

const mockTransporter = {
  sendMail: mockSendMailFunction,
  verify: jest.fn().mockResolvedValue(true),
};

const mockNodemailer = {
  createTransport: jest.fn().mockReturnValue(mockTransporter),
};

module.exports = {
  mockSendMailFunction,
  mockTransporter,
  mockNodemailer,
};