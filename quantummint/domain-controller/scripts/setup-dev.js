#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up QuantumMint Domain Controller Development Environment...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please update it with your configuration.\n');
} else {
  console.log('✅ .env file already exists.\n');
}

// Create logs directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  console.log('📁 Creating logs directory...');
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Logs directory created.\n');
}

// Create certificates directory
const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  console.log('🔐 Creating certificates directory...');
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('✅ Certificates directory created.\n');
}

// Generate self-signed certificates for development
const certPath = path.join(certsDir, 'server.crt');
const keyPath = path.join(certsDir, 'server.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('🔑 Generating self-signed SSL certificates for development...');
  try {
    execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=CA/L=San Francisco/O=QuantumMint/OU=Domain Controller/CN=quantummint.local"`, { stdio: 'inherit' });
    console.log('✅ SSL certificates generated.\n');
  } catch (error) {
    console.log('⚠️  OpenSSL not found. SSL certificates will be generated at runtime.\n');
  }
}

// Check dependencies
console.log('📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies || {});
  console.log(`✅ Found ${dependencies.length} dependencies in package.json.\n`);
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

// Check for required services
console.log('🔍 Checking for required services...');

const services = [
  { name: 'MongoDB', command: 'mongod --version', port: 27017 },
  { name: 'Redis', command: 'redis-server --version', port: 6379 }
];

for (const service of services) {
  try {
    execSync(service.command, { stdio: 'ignore' });
    console.log(`✅ ${service.name} is installed.`);
  } catch (error) {
    console.log(`⚠️  ${service.name} is not installed or not in PATH.`);
    console.log(`   Please install ${service.name} and ensure it's running on port ${service.port}.`);
  }
}

console.log('\n🎯 Development Environment Setup Complete!');
console.log('\nNext steps:');
console.log('1. Update .env file with your configuration');
console.log('2. Start MongoDB and Redis services');
console.log('3. Run: npm install');
console.log('4. Run: npm start');
console.log('5. Test with: node scripts/test-domain-controller.js');
console.log('\n📚 Documentation: See README.md for detailed setup instructions.');
