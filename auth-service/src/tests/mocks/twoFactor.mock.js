// Mock for speakeasy and qrcode
const mockSpeakeasy = {
  generateSecret: jest.fn().mockReturnValue({
    base32: 'mock-secret',
    otpauth_url: 'otpauth://totp/QuantumMint:test@example.com?secret=mock-secret&issuer=QuantumMint',
  }),
  totp: {
    verify: jest.fn().mockImplementation(({ secret, encoding, token }) => {
      return token === '123456';
    }),
    generate: jest.fn().mockReturnValue('123456'),
  },
};

const mockQrcode = {
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
};

module.exports = {
  mockSpeakeasy,
  mockQrcode,
};
