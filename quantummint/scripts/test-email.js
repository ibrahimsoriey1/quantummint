#!/usr/bin/env node

/**
 * Test script for email functionality
 * Usage: node scripts/test-email.js <email>
 */

const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnv() {
  const envFiles = ['.env', '.env.development'];
  
  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            process.env[key] = value;
          }
        }
      }
      console.log(`📁 Loaded environment from: ${envFile}`);
      break;
    }
  }
}

loadEnv();
const emailService = require('../shared/utils/email');

async function testEmail() {
  const testEmail = process.argv[2];
  
  if (!testEmail) {
    console.log('Usage: node scripts/test-email.js <email>');
    process.exit(1);
  }

  console.log('🧪 Testing email service...');
  console.log(`📧 Sending test email to: ${testEmail}`);
  
  try {
    // Test password reset email
    const resetToken = 'test-reset-token-12345';
    const result = await emailService.sendPasswordResetEmail(testEmail, resetToken, 'Test User');
    
    console.log('✅ Email sent successfully!');
    console.log('📋 Result:', result);
    
    if (result.previewUrl) {
      console.log('🔗 Preview URL (for test accounts):', result.previewUrl);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.message.includes('SMTP')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Check your .env.development file exists');
      console.log('2. Verify SMTP credentials are correct');
      console.log('3. For Gmail: use App Password, not regular password');
      console.log('4. Ensure 2FA is enabled on Gmail account');
    }
  }
}

testEmail();
