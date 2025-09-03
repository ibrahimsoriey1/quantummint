const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Email templates
const emailTemplates = {
  emailVerification: (data) => ({
    subject: 'Verify Your Email - QuantumMint',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .verification-code { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 QuantumMint</h1>
            <p>Digital Money Generation Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${data.name}!</h2>
            <p>Welcome to QuantumMint! To complete your registration and start generating digital money, please verify your email address.</p>
            
            <div class="verification-code">
              Verification Token: <strong>${data.verificationToken}</strong>
            </div>
            
            <p>This verification token will expire on: <strong>${new Date(data.verificationExpires).toLocaleString()}</strong></p>
            
            <p>If you didn't create an account with QuantumMint, please ignore this email.</p>
            
            <p>Best regards,<br>The QuantumMint Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name}!
      
      Welcome to QuantumMint! To complete your registration and start generating digital money, please verify your email address.
      
      Verification Token: ${data.verificationToken}
      
      This verification token will expire on: ${new Date(data.verificationExpires).toLocaleString()}
      
      If you didn't create an account with QuantumMint, please ignore this email.
      
      Best regards,
      The QuantumMint Team
    `
  }),

  passwordReset: (data) => ({
    subject: 'Password Reset Request - QuantumMint',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request - QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .reset-code { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; font-size: 18px; font-weight: bold; color: #667eea; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 QuantumMint</h1>
            <p>Digital Money Generation Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${data.name}!</h2>
            <p>We received a request to reset your password for your QuantumMint account.</p>
            
            <div class="reset-code">
              Reset Token: <strong>${data.resetToken}</strong>
            </div>
            
            <p>This reset token will expire on: <strong>${new Date(data.resetExpires).toLocaleString()}</strong></p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and ensure your account is secure.
            </div>
            
            <p>Best regards,<br>The QuantumMint Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name}!
      
      We received a request to reset your password for your QuantumMint account.
      
      Reset Token: ${data.resetToken}
      
      This reset token will expire on: ${new Date(data.resetExpires).toLocaleString()}
      
      ⚠️ Security Notice: If you didn't request this password reset, please ignore this email and ensure your account is secure.
      
      Best regards,
      The QuantumMint Team
    `
  }),

  twoFactorSetup: (data) => ({
    subject: 'Two-Factor Authentication Setup - QuantumMint',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Two-Factor Authentication Setup - QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .qr-code { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .secret { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 QuantumMint</h1>
            <p>Digital Money Generation Platform</p>
          </div>
          <div class="content">
            <h2>Hello ${data.name}!</h2>
            <p>You have successfully enabled Two-Factor Authentication (2FA) for your QuantumMint account.</p>
            
            <div class="qr-code">
              <p><strong>Scan this QR code with your authenticator app:</strong></p>
              <img src="${data.qrCodeUrl}" alt="QR Code" style="max-width: 200px;">
            </div>
            
            <div class="secret">
              <p><strong>Manual entry secret:</strong></p>
              <code>${data.secret}</code>
            </div>
            
            <p><strong>Supported apps:</strong> Google Authenticator, Authy, Microsoft Authenticator, or any TOTP-compatible app.</p>
            
            <p>Best regards,<br>The QuantumMint Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${data.name}!
      
      You have successfully enabled Two-Factor Authentication (2FA) for your QuantumMint account.
      
      Manual entry secret: ${data.secret}
      
      Supported apps: Google Authenticator, Authy, Microsoft Authenticator, or any TOTP-compatible app.
      
      Best regards,
      The QuantumMint Team
    `
  }),

  accountLocked: (data) => ({
    subject: 'Account Security Alert - QuantumMint',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Security Alert - QuantumMint</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .alert { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; color: #721c24; }
          .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; color: #0c5460; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 QuantumMint</h1>
            <p>Digital Money Generation Platform</p>
          </div>
          <div class="content">
            <h2>Security Alert</h2>
            <p>Hello ${data.name},</p>
            
            <div class="alert">
              <strong>⚠️ Your account has been temporarily locked due to multiple failed login attempts.</strong>
            </div>
            
            <p>This is a security measure to protect your account from unauthorized access attempts.</p>
            
            <div class="info">
              <p><strong>Account locked at:</strong> ${new Date(data.lockedAt).toLocaleString()}</p>
              <p><strong>Lock duration:</strong> 2 hours</p>
              <p><strong>Failed attempts:</strong> ${data.failedAttempts}</p>
            </div>
            
            <p>Your account will be automatically unlocked after 2 hours, or you can contact support for immediate assistance.</p>
            
            <p>If this was you, please ensure you're using the correct password. If you've forgotten your password, you can reset it using the "Forgot Password" feature.</p>
            
            <p>Best regards,<br>The QuantumMint Security Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 QuantumMint. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Security Alert
      
      Hello ${data.name},
      
      ⚠️ Your account has been temporarily locked due to multiple failed login attempts.
      
      This is a security measure to protect your account from unauthorized access attempts.
      
      Account locked at: ${new Date(data.lockedAt).toLocaleString()}
      Lock duration: 2 hours
      Failed attempts: ${data.failedAttempts}
      
      Your account will be automatically unlocked after 2 hours, or you can contact support for immediate assistance.
      
      If this was you, please ensure you're using the correct password. If you've forgotten your password, you can reset it using the "Forgot Password" feature.
      
      Best regards,
      The QuantumMint Security Team
    `
  })
};

// Send email function
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    // Get template
    const template = emailTemplates[options.template];
    if (!template) {
      throw new Error(`Email template '${options.template}' not found`);
    }

    // Generate email content
    const emailContent = template(options.data);
    
    // Email options
    const mailOptions = {
      from: `"QuantumMint" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    logger.email('Email sent successfully', {
      messageId: info.messageId,
      to: options.to,
      template: options.template
    });

    return info;

  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

// Send verification email
const sendVerificationEmail = async (user, verificationToken, verificationExpires) => {
  return sendEmail({
    to: user.email,
    template: 'emailVerification',
    data: {
      name: user.firstName,
      verificationToken,
      verificationExpires
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken, resetExpires) => {
  return sendEmail({
    to: user.email,
    template: 'passwordReset',
    data: {
      name: user.firstName,
      resetToken,
      resetExpires
    }
  });
};

// Send 2FA setup email
const sendTwoFactorSetupEmail = async (user, secret, qrCodeUrl) => {
  return sendEmail({
    to: user.email,
    template: 'twoFactorSetup',
    data: {
      name: user.firstName,
      secret,
      qrCodeUrl
    }
  });
};

// Send account locked email
const sendAccountLockedEmail = async (user, lockedAt, failedAttempts) => {
  return sendEmail({
    to: user.email,
    template: 'accountLocked',
    data: {
      name: user.firstName,
      lockedAt,
      failedAttempts
    }
  });
};

// Test email connection
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.email('Email connection test successful');
    return true;
  } catch (error) {
    logger.error('Email connection test failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTwoFactorSetupEmail,
  sendAccountLockedEmail,
  testEmailConnection,
  emailTemplates
};
