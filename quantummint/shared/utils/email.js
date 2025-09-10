const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeTransporter();
    }
  }

  async initializeTransporter() {
    // Configure email transporter based on environment
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // For development, use ethereal email for testing if no credentials or if credentials fail
    if (process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      logger.warn('SMTP credentials not configured. Using test account for development.');
      await this.createTestAccount();
      this.initialized = true;
      return;
    }

    this.transporter = nodemailer.createTransport(emailConfig);
    
    // Verify connection configuration
    try {
      await this.transporter.verify();
      logger.info('Email service is ready to send messages');
      this.initialized = true;
    } catch (error) {
      logger.error('Email service configuration error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Falling back to test email account for development.');
        await this.createTestAccount();
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      logger.info('Test email account created:', {
        user: testAccount.user,
        pass: testAccount.pass
      });
    } catch (error) {
      logger.error('Failed to create test email account:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email, resetToken, firstName) {
    try {
      await this.ensureInitialized();
      
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: `"QuantumMint" <${process.env.SMTP_FROM || 'noreply@quantummint.com'}>`,
        to: email,
        subject: 'Password Reset Request - QuantumMint',
        html: this.getPasswordResetTemplate(firstName, resetUrl, resetToken)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Password reset email sent:', {
        messageId: info.messageId,
        email: email,
        previewUrl: nodemailer.getTestMessageUrl(info) // Only works with Ethereal
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  getPasswordResetTemplate(firstName, resetUrl, resetToken) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <p>QuantumMint Digital Money System</p>
          </div>
          <div class="content">
            <h2>Hello ${firstName || 'User'},</h2>
            <p>We received a request to reset your password for your QuantumMint account. If you didn't make this request, you can safely ignore this email.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${resetUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 10 minutes for security reasons</li>
                <li>Only use this link if you requested a password reset</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If you're having trouble with the button above, you can also use this reset token directly:</p>
            <p><strong>Reset Token:</strong> <code style="background: #f0f0f0; padding: 5px; border-radius: 3px;">${resetToken}</code></p>
          </div>
          <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendWelcomeEmail(email, firstName) {
    try {
      await this.ensureInitialized();
      
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: `"QuantumMint" <${process.env.SMTP_FROM || 'noreply@quantummint.com'}>`,
        to: email,
        subject: 'Welcome to QuantumMint - Your Digital Money Journey Begins!',
        html: this.getWelcomeTemplate(firstName)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Welcome email sent:', {
        messageId: info.messageId,
        email: email
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  getWelcomeTemplate(firstName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to QuantumMint!</h1>
            <p>Your Digital Money Journey Starts Here</p>
          </div>
          <div class="content">
            <h2>Hello ${firstName || 'User'},</h2>
            <p>Welcome to QuantumMint, the revolutionary digital money system! We're excited to have you join our community.</p>
            
            <h3>What you can do with QuantumMint:</h3>
            
            <div class="feature">
              <h4>💰 Generate Digital Money</h4>
              <p>Create quantum-backed digital currency through our innovative generation system.</p>
            </div>
            
            <div class="feature">
              <h4>🔄 Instant Transactions</h4>
              <p>Send and receive money instantly with our secure transaction system.</p>
            </div>
            
            <div class="feature">
              <h4>🛡️ KYC Verification</h4>
              <p>Complete your identity verification to unlock all platform features.</p>
            </div>
            
            <div class="feature">
              <h4>💳 Payment Integration</h4>
              <p>Connect with multiple payment providers for seamless transactions.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">Get Started</a>
            </div>
            
            <p>If you have any questions, our support team is here to help!</p>
          </div>
          <div class="footer">
            <p>© 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
