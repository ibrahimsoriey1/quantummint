const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

class QuantumMailClient {
  constructor(config = {}) {
    this.apiEndpoint = config.apiEndpoint || process.env.MAIL_API_ENDPOINT || 'http://localhost:8081';
    this.serviceId = config.serviceId;
    this.serviceName = config.serviceName;
    this.token = config.token || this.generateServiceToken();
  }

  generateServiceToken() {
    if (!this.serviceId || !this.serviceName) {
      throw new Error('Service ID and name are required for mail client');
    }

    return jwt.sign(
      {
        serviceId: this.serviceId,
        serviceName: this.serviceName,
        permissions: ['email:send', 'email:status'],
        defaultFrom: 'noreply@quantummint.com'
      },
      process.env.JWT_SECRET || 'quantum-mail-secret',
      { expiresIn: '365d' }
    );
  }

  async sendEmail(emailData) {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Mail client error:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(userEmail, userData) {
    return await this.sendEmail({
      to: [userEmail],
      subject: 'Welcome to QuantumMint',
      content: this.getWelcomeTemplate(userData),
      contentType: 'text/html',
      template: 'welcome'
    });
  }

  async sendPasswordResetEmail(userEmail, resetToken, userData) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    return await this.sendEmail({
      to: [userEmail],
      subject: 'Password Reset Request - QuantumMint',
      content: this.getPasswordResetTemplate(userData, resetUrl),
      contentType: 'text/html',
      template: 'password-reset'
    });
  }

  async sendTransactionNotification(userEmail, transactionData) {
    return await this.sendEmail({
      to: [userEmail],
      subject: `Transaction ${transactionData.type} - QuantumMint`,
      content: this.getTransactionTemplate(transactionData),
      contentType: 'text/html',
      template: 'transaction'
    });
  }

  getWelcomeTemplate(userData) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
        <h1>Welcome to QuantumMint!</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2>Hello ${userData.firstName || 'User'},</h2>
        <p>Welcome to QuantumMint, the future of digital finance.</p>
        <p style="text-align: center;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Get Started</a>
        </p>
      </div>
    </div>`;
  }

  getPasswordResetTemplate(userData, resetUrl) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 30px; text-align: center;">
        <h1>Password Reset Request</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2>Hello ${userData.firstName || 'User'},</h2>
        <p>Click the button below to reset your password:</p>
        <p style="text-align: center;">
          <a href="${resetUrl}" style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </p>
        <p><strong>This link expires in 10 minutes.</strong></p>
      </div>
    </div>`;
  }

  getTransactionTemplate(transactionData) {
    const color = transactionData.type === 'credit' ? '#28a745' : '#dc3545';
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 30px; text-align: center;">
        <h1>Transaction ${transactionData.type}</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <p><strong>Amount:</strong> ${transactionData.currency} ${transactionData.amount}</p>
        <p><strong>Transaction ID:</strong> ${transactionData.transactionId}</p>
        <p><strong>Status:</strong> ${transactionData.status}</p>
      </div>
    </div>`;
  }
}

module.exports = QuantumMailClient;
