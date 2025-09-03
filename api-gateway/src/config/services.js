require('dotenv').config();

// Service URLs
const services = {
  auth: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    routes: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      verifyEmail: '/api/auth/verify-email',
      forgotPassword: '/api/auth/forgot-password',
      resetPassword: '/api/auth/reset-password',
      refreshToken: '/api/auth/refresh-token',
      logout: '/api/auth/logout',
      profile: '/api/users/profile',
      twoFactor: '/api/2fa'
    }
  },
  moneyGeneration: {
    url: process.env.MONEY_GENERATION_SERVICE_URL || 'http://localhost:3002',
    routes: {
      generation: '/api/generation',
      wallet: '/api/wallets'
    }
  },
  transaction: {
    url: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003',
    routes: {
      transactions: '/api/transactions',
      balances: '/api/balances'
    }
  },
  payment: {
    url: process.env.PAYMENT_INTEGRATION_SERVICE_URL || 'http://localhost:3004',
    routes: {
      payments: '/api/payments',
      providers: '/api/providers',
      webhooks: '/api/webhooks'
    }
  },
  kyc: {
    url: process.env.KYC_SERVICE_URL || 'http://localhost:3005',
    routes: {
      profile: '/api/kyc/profile',
      status: '/api/kyc/status',
      verify: '/api/kyc/verify',
      documents: '/api/documents',
      verifications: '/api/verifications'
    }
  }
};

// Service key for internal communication
const SERVICE_KEY = process.env.SERVICE_KEY || 'default_service_key';

module.exports = { services, SERVICE_KEY };