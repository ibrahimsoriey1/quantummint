const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class AfriMoneyProvider {
  constructor() {
    this.name = 'afrimoney';
    this.baseUrl = process.env.AFRIMONEY_BASE_URL || 'https://api.afrimoney.com/v1';
    this.apiKey = process.env.AFRIMONEY_API_KEY;
    this.secret = process.env.AFRIMONEY_SECRET;
  }

  async processPayment(payment, paymentMethodDetails) {
    try {
      const { amount, currency, description } = payment;
      const { phoneNumber, country, network } = paymentMethodDetails;

      if (payment.type === 'deposit') {
        // Initiate mobile money collection
        const collectionData = {
          amount: amount,
          currency: currency,
          external_id: payment.paymentId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: phoneNumber
          },
          payerMessage: description || `Deposit to QuantumMint`,
          payeeNote: `Payment for user ${payment.userId}`,
          callbackUrl: `${process.env.API_GATEWAY_URL}/api/payments/webhooks/afrimoney`
        };

        const response = await axios.post(`${this.baseUrl}/collection/v1_0/requesttopay`, collectionData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`,
            'X-Reference-Id': payment.paymentId,
            'X-Target-Environment': process.env.AFRIMONEY_ENVIRONMENT || 'sandbox',
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });

        return {
          transactionId: payment.paymentId,
          status: 'pending',
          metadata: {
            referenceId: payment.paymentId,
            phoneNumber: phoneNumber,
            network: network
          }
        };
      } else if (payment.type === 'withdrawal') {
        // Initiate disbursement
        const disbursementData = {
          amount: amount,
          currency: currency,
          external_id: payment.paymentId,
          payee: {
            partyIdType: 'MSISDN',
            partyId: phoneNumber
          },
          payerMessage: description || `Withdrawal from QuantumMint`,
          payeeNote: `Payout for user ${payment.userId}`,
          callbackUrl: `${process.env.API_GATEWAY_URL}/api/payments/webhooks/afrimoney`
        };

        const response = await axios.post(`${this.baseUrl}/disbursement/v1_0/transfer`, disbursementData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`,
            'X-Reference-Id': payment.paymentId,
            'X-Target-Environment': process.env.AFRIMONEY_ENVIRONMENT || 'sandbox',
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });

        return {
          transactionId: payment.paymentId,
          status: 'processing',
          metadata: {
            referenceId: payment.paymentId,
            phoneNumber: phoneNumber,
            network: network
          }
        };
      }

      throw new Error(`Unsupported payment type: ${payment.type}`);
    } catch (error) {
      logger.error('AfriMoney payment processing error:', error);
      return {
        status: 'failed',
        failureReason: error.response?.data?.message || error.message
      };
    }
  }

  async getAccessToken() {
    try {
      const response = await axios.post(`${this.baseUrl}/collection/token/`, {}, {
        auth: {
          username: this.apiKey,
          password: this.secret
        },
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('AfriMoney token error:', error);
      throw new Error('Failed to get access token');
    }
  }

  async getPaymentStatus(referenceId) {
    try {
      const response = await axios.get(`${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'X-Target-Environment': process.env.AFRIMONEY_ENVIRONMENT || 'sandbox',
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      return {
        status: this.mapAfriMoneyStatus(response.data.status),
        transactionId: response.data.financialTransactionId,
        amount: response.data.amount,
        currency: response.data.currency,
        reason: response.data.reason
      };
    } catch (error) {
      logger.error('AfriMoney status check error:', error);
      throw error;
    }
  }

  mapAfriMoneyStatus(afriMoneyStatus) {
    const statusMap = {
      'PENDING': 'pending',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',
      'TIMEOUT': 'failed',
      'CANCELLED': 'cancelled'
    };

    return statusMap[afriMoneyStatus] || 'pending';
  }

  generateSignature(data, timestamp) {
    const payload = JSON.stringify(data) + timestamp + this.secret;
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  async verifySignature(data, signature, timestamp) {
    const expectedSignature = this.generateSignature(data, timestamp);
    return expectedSignature === signature;
  }

  async handleWebhook(payload) {
    try {
      const { referenceId, status, financialTransactionId, amount, currency, reason } = payload;

      return {
        paymentId: referenceId,
        status: this.mapAfriMoneyStatus(status),
        providerTransactionId: financialTransactionId,
        processedAt: new Date(),
        metadata: {
          afriMoneyTransactionId: financialTransactionId,
          amount: parseFloat(amount),
          currency: currency,
          reason: reason
        }
      };
    } catch (error) {
      logger.error('AfriMoney webhook handling error:', error);
      throw error;
    }
  }

  async cancelPayment(referenceId) {
    try {
      // AfriMoney doesn't have a direct cancel endpoint
      // We check status and if it's still pending, we can consider it cancelled
      const status = await this.getPaymentStatus(referenceId);
      
      if (status.status === 'pending') {
        return {
          success: true,
          status: 'cancelled'
        };
      } else {
        throw new Error(`Cannot cancel payment with status: ${status.status}`);
      }
    } catch (error) {
      logger.error('AfriMoney payment cancellation error:', error);
      throw error;
    }
  }

  // AfriMoney typically doesn't support refunds through API
  async refundPayment(transactionId, amount, reason) {
    throw new Error('Refunds not supported by AfriMoney. Please contact support for manual refund.');
  }

  async getBalance() {
    try {
      const response = await axios.get(`${this.baseUrl}/collection/v1_0/account/balance`, {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'X-Target-Environment': process.env.AFRIMONEY_ENVIRONMENT || 'sandbox',
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      return {
        availableBalance: response.data.availableBalance,
        currency: response.data.currency
      };
    } catch (error) {
      logger.error('AfriMoney balance check error:', error);
      throw error;
    }
  }

  async validateAccount(phoneNumber, network) {
    try {
      const response = await axios.get(`${this.baseUrl}/collection/v1_0/accountholder/msisdn/${phoneNumber}/active`, {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
          'X-Target-Environment': process.env.AFRIMONEY_ENVIRONMENT || 'sandbox',
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      return {
        isValid: response.data.result,
        network: network
      };
    } catch (error) {
      logger.error('AfriMoney account validation error:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}

module.exports = new AfriMoneyProvider();
