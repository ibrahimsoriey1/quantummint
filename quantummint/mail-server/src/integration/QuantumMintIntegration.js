const jwt = require('jsonwebtoken');
const { integration: logger } = require('../utils/logger');

class QuantumMintIntegration {
  constructor(config) {
    this.config = config;
    this.mailQueue = config.mailQueue;
    this.analyticsService = config.analyticsService;
    this.serviceTokens = new Map();
    
    this.initializeServiceIntegration();
  }

  initializeServiceIntegration() {
    // Generate service tokens for QuantumMint services
    const services = [
      { id: 'auth-service', name: 'Authentication Service', port: 3002 },
      { id: 'transaction-service', name: 'Transaction Service', port: 3003 },
      { id: 'payment-service', name: 'Payment Integration Service', port: 3004 },
      { id: 'kyc-service', name: 'KYC Service', port: 3005 },
      { id: 'money-generation', name: 'Money Generation Service', port: 3006 },
      { id: 'api-gateway', name: 'API Gateway', port: 3001 }
    ];

    services.forEach(service => {
      const token = this.generateServiceToken(service);
      this.serviceTokens.set(service.id, token);
      logger.info('Service token generated', { serviceId: service.id });
    });
  }

  generateServiceToken(service) {
    return jwt.sign(
      {
        serviceId: service.id,
        serviceName: service.name,
        permissions: ['email:send', 'email:status', 'user:create'],
        defaultFrom: `noreply@quantummint.com`,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET || 'quantum-mail-secret',
      { expiresIn: '365d' }
    );
  }

  getServiceToken(serviceId) {
    return this.serviceTokens.get(serviceId);
  }

  // Email templates for QuantumMint services
  async sendWelcomeEmail(userEmail, userData) {
    const emailData = {
      to: [{ address: userEmail }],
      subject: 'Welcome to QuantumMint - Your Digital Finance Journey Begins',
      content: this.getWelcomeTemplate(userData),
      contentType: 'text/html',
      template: 'welcome',
      source: 'auth-service'
    };

    return await this.mailQueue.addEmail(emailData);
  }

  async sendPasswordResetEmail(userEmail, resetToken, userData) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailData = {
      to: [{ address: userEmail }],
      subject: 'Password Reset Request - QuantumMint',
      content: this.getPasswordResetTemplate(userData, resetUrl),
      contentType: 'text/html',
      template: 'password-reset',
      source: 'auth-service'
    };

    return await this.mailQueue.addEmail(emailData);
  }

  async sendTransactionNotification(userEmail, transactionData) {
    const emailData = {
      to: [{ address: userEmail }],
      subject: `Transaction ${transactionData.type} - QuantumMint`,
      content: this.getTransactionTemplate(transactionData),
      contentType: 'text/html',
      template: 'transaction',
      source: 'transaction-service'
    };

    return await this.mailQueue.addEmail(emailData);
  }

  async sendKYCStatusUpdate(userEmail, kycData) {
    const emailData = {
      to: [{ address: userEmail }],
      subject: 'KYC Verification Update - QuantumMint',
      content: this.getKYCTemplate(kycData),
      contentType: 'text/html',
      template: 'kyc-update',
      source: 'kyc-service'
    };

    return await this.mailQueue.addEmail(emailData);
  }

  async sendPaymentConfirmation(userEmail, paymentData) {
    const emailData = {
      to: [{ address: userEmail }],
      subject: 'Payment Confirmation - QuantumMint',
      content: this.getPaymentTemplate(paymentData),
      contentType: 'text/html',
      template: 'payment',
      source: 'payment-service'
    };

    return await this.mailQueue.addEmail(emailData);
  }

  // Email templates
  getWelcomeTemplate(userData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to QuantumMint</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to QuantumMint!</h1>
            <p>Your Digital Finance Journey Begins</p>
        </div>
        <div class="content">
            <h2>Hello ${userData.firstName || 'User'},</h2>
            <p>Welcome to QuantumMint, the future of digital finance. We're excited to have you join our community of forward-thinking individuals who are embracing the next generation of financial technology.</p>
            
            <h3>What's Next?</h3>
            <ul>
                <li>Complete your profile setup</li>
                <li>Verify your identity through our KYC process</li>
                <li>Explore our digital money generation features</li>
                <li>Start your first transaction</li>
            </ul>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
            </p>
            
            <p>If you have any questions, our support team is here to help. Simply reply to this email or visit our help center.</p>
        </div>
        <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
        </div>
    </div>
</body>
</html>`;
  }

  getPasswordResetTemplate(userData, resetUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Reset - QuantumMint</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <h2>Hello ${userData.firstName || 'User'},</h2>
            <p>We received a request to reset your QuantumMint account password. If you made this request, click the button below to reset your password:</p>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            
            <div class="warning">
                <strong>Security Notice:</strong>
                <ul>
                    <li>This link will expire in 10 minutes</li>
                    <li>If you didn't request this reset, please ignore this email</li>
                    <li>Never share this link with anyone</li>
                </ul>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 3px;">${resetUrl}</p>
        </div>
        <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  getTransactionTemplate(transactionData) {
    const isCredit = transactionData.type === 'credit';
    const color = isCredit ? '#28a745' : '#dc3545';
    const icon = isCredit ? '↗️' : '↙️';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transaction ${transactionData.type} - QuantumMint</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .transaction-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: ${color}; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${icon} Transaction ${transactionData.type.charAt(0).toUpperCase() + transactionData.type.slice(1)}</h1>
        </div>
        <div class="content">
            <p>Your QuantumMint transaction has been processed successfully.</p>
            
            <div class="transaction-details">
                <h3>Transaction Details</h3>
                <p><strong>Amount:</strong> <span class="amount">${transactionData.currency} ${transactionData.amount}</span></p>
                <p><strong>Transaction ID:</strong> ${transactionData.transactionId}</p>
                <p><strong>Date:</strong> ${new Date(transactionData.date).toLocaleString()}</p>
                <p><strong>Description:</strong> ${transactionData.description || 'N/A'}</p>
                <p><strong>Status:</strong> ${transactionData.status}</p>
            </div>
            
            <p>You can view all your transactions in your QuantumMint dashboard.</p>
        </div>
        <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  getKYCTemplate(kycData) {
    const statusColor = kycData.status === 'approved' ? '#28a745' : 
                       kycData.status === 'rejected' ? '#dc3545' : '#ffc107';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>KYC Verification Update - QuantumMint</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .status-badge { background: ${statusColor}; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KYC Verification Update</h1>
        </div>
        <div class="content">
            <p>Your KYC (Know Your Customer) verification status has been updated.</p>
            
            <p><strong>Status:</strong> <span class="status-badge">${kycData.status.toUpperCase()}</span></p>
            
            ${kycData.status === 'approved' ? 
              '<p>Congratulations! Your identity has been verified. You now have full access to all QuantumMint features.</p>' :
              kycData.status === 'rejected' ? 
              `<p>Unfortunately, we were unable to verify your identity. Reason: ${kycData.reason || 'Please contact support for more information.'}</p>` :
              '<p>Your verification is still in progress. We will notify you once the review is complete.</p>'
            }
            
            <p>If you have any questions about your verification status, please contact our support team.</p>
        </div>
        <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  getPaymentTemplate(paymentData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment Confirmation - QuantumMint</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .payment-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Payment Confirmed</h1>
        </div>
        <div class="content">
            <p>Your payment has been processed successfully through QuantumMint.</p>
            
            <div class="payment-details">
                <h3>Payment Details</h3>
                <p><strong>Amount:</strong> <span class="amount">${paymentData.currency} ${paymentData.amount}</span></p>
                <p><strong>Payment ID:</strong> ${paymentData.paymentId}</p>
                <p><strong>Method:</strong> ${paymentData.method}</p>
                <p><strong>Date:</strong> ${new Date(paymentData.date).toLocaleString()}</p>
                <p><strong>Status:</strong> ${paymentData.status}</p>
            </div>
            
            <p>A receipt has been generated and is available in your QuantumMint dashboard.</p>
        </div>
        <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Integration endpoints for services
  async handleServiceEmailRequest(serviceId, emailType, data) {
    try {
      let result;
      
      switch (emailType) {
        case 'welcome':
          result = await this.sendWelcomeEmail(data.email, data.userData);
          break;
        case 'password-reset':
          result = await this.sendPasswordResetEmail(data.email, data.resetToken, data.userData);
          break;
        case 'transaction':
          result = await this.sendTransactionNotification(data.email, data.transactionData);
          break;
        case 'kyc-update':
          result = await this.sendKYCStatusUpdate(data.email, data.kycData);
          break;
        case 'payment':
          result = await this.sendPaymentConfirmation(data.email, data.paymentData);
          break;
        default:
          throw new Error(`Unknown email type: ${emailType}`);
      }

      logger.info('Service email sent', { serviceId, emailType, jobId: result.id });
      return result;

    } catch (error) {
      logger.error('Service email failed', { serviceId, emailType, error: error.message });
      throw error;
    }
  }

  // Service configuration
  getServiceConfiguration() {
    return {
      apiEndpoint: `http://localhost:${this.config.apiPort || 8081}`,
      tokens: Object.fromEntries(this.serviceTokens),
      emailTypes: [
        'welcome',
        'password-reset', 
        'transaction',
        'kyc-update',
        'payment'
      ]
    };
  }
}

module.exports = QuantumMintIntegration;
