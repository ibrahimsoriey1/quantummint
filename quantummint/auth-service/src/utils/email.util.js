const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger.util');

// Email templates directory
const templatesDir = path.join(__dirname, '../templates/emails');

// Create email transport
const createTransport = () => {
  // In development, use ethereal.email for testing
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'ethereal_user',
        pass: process.env.EMAIL_PASSWORD || 'ethereal_password'
      }
    });
  }
  
  // In production, use configured SMTP server
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

/**
 * Load email template and replace placeholders with data
 * @param {string} templateName - Template name
 * @param {Object} data - Data to replace placeholders
 * @returns {Promise<string>} Rendered template
 */
const loadTemplate = async (templateName, data) => {
  try {
    // Load template file
    const templatePath = path.join(templatesDir, `${templateName}.html`);
    let template = await fs.readFile(templatePath, 'utf8');
    
    // Replace placeholders with data
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, data[key]);
    });
    
    return template;
  } catch (error) {
    logger.error(`Error loading email template: ${error.message}`);
    throw error;
  }
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Email template name
 * @param {Object} options.data - Data to replace placeholders in template
 * @returns {Promise<Object>} Nodemailer info object
 */
exports.sendEmail = async ({ to, subject, template, data }) => {
  try {
    // Create transport
    const transport = createTransport();
    
    // Load and render template
    const html = await loadTemplate(template, data);
    
    // Send email
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || 'QuantumMint <noreply@quantummint.com>',
      to,
      subject,
      html
    });
    
    logger.info(`Email sent: ${info.messageId}`);
    
    return info;
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    throw error;
  }
};