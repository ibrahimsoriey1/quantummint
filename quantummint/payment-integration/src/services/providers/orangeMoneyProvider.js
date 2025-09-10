const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class OrangeMoneyProvider {
  constructor() {
    this.name = 'orange_money';
    this.baseUrl = process.env.ORANGE_MONEY_BASE_URL || 'https://api.orange.com/orange-money-webpay/dev/v1';
    this.apiKey = process.env.ORANGE_MONEY_API_KEY;
    this.secret = process.env.ORANGE_MONEY_SECRET;
  }

  async processPayment(payment, paymentMethodDetails) {
    try {
      const { amount, currency, description } = payment;
      const { phoneNumber, country } = paymentMethodDetails;

      if (payment.type === 'deposit') {
        // Initiate mobile money payment
        const paymentData = {
          merchant_key: this.apiKey,
          currency: currency,
          order_id: payment.paymentId,
          amount: amount,
          return_url: `${process.env.FRONTEND_URL}/payment/return`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
          notif_url: `${process.env.API_GATEWAY_URL}/api/payments/webhooks/orange-money`,
          lang: 'en',
          reference: `QM-${payment.paymentId}`,
          customer_msisdn: phoneNumber,
          customer_country_code: country || 'CI'
        };

        // Generate signature
        const signature = this.generateSignature(paymentData);
        paymentData.signature = signature;

        const response = await axios.post(`${this.baseUrl}/webpayment`, paymentData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`
          }
        });

        if (response.data.status === 'SUCCESS') {
          return {
            transactionId: response.data.pay_token,
            status: 'pending',
            metadata: {
              payToken: response.data.pay_token,
              paymentUrl: response.data.payment_url,
              phoneNumber: phoneNumber
            }
          };
        } else {
          throw new Error(response.data.message || 'Payment initiation failed');
        }
      } else if (payment.type === 'withdrawal') {
        // Initiate payout
        const payoutData = {
          partner_id: this.apiKey,
          reference: payment.paymentId,
          subscriberMsisdn: phoneNumber,
          amount: amount,
          currency: currency,
          description: description || `Withdrawal from QuantumMint`,
          metadata: {
            userId: payment.userId,
            paymentId: payment.paymentId
          }
        };

        const response = await axios.post(`${this.baseUrl}/cashin`, payoutData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`
          }
        });

        if (response.data.status === 'SUCCESS') {
          return {
            transactionId: response.data.transaction_id,
            status: 'processing',
            metadata: {
              transactionId: response.data.transaction_id,
              phoneNumber: phoneNumber
            }
          };
        } else {
          throw new Error(response.data.message || 'Payout initiation failed');
        }
      }

      throw new Error(`Unsupported payment type: ${payment.type}`);
    } catch (error) {
      logger.error('Orange Money payment processing error:', error);
      return {
        status: 'failed',
        failureReason: error.message
      };
    }
  }

  async getAccessToken() {
    try {
      const response = await axios.post(`${this.baseUrl}/oauth/token`, {
        grant_type: 'client_credentials'
      }, {
        auth: {
          username: this.apiKey,
          password: this.secret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Orange Money token error:', error);
      throw new Error('Failed to get access token');
    }
  }

  generateSignature(data) {
    const sortedKeys = Object.keys(data).sort();
    let signatureString = '';
    
    sortedKeys.forEach(key => {
      if (key !== 'signature') {
        signatureString += `${key}=${data[key]}&`;
      }
    });
    
    signatureString = signatureString.slice(0, -1); // Remove last &
    signatureString += this.secret;
    
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  }

  async verifySignature(data, signature) {
    const expectedSignature = this.generateSignature(data);
    return expectedSignature === signature;
  }

  async getPaymentStatus(transactionId) {
    try {
      const response = await axios.get(`${this.baseUrl}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`
        }
      });

      return {
        status: this.mapOrangeMoneyStatus(response.data.status),
        transactionId: response.data.transaction_id,
        amount: response.data.amount,
        currency: response.data.currency
      };
    } catch (error) {
      logger.error('Orange Money status check error:', error);
      throw error;
    }
  }

  mapOrangeMoneyStatus(orangeStatus) {
    const statusMap = {
      'PENDING': 'pending',
      'INITIATED': 'processing',
      'SUCCESS': 'completed',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'failed'
    };

    return statusMap[orangeStatus] || 'pending';
  }

  async handleWebhook(payload) {
    try {
      const { transaction_id, status, amount, currency, reference } = payload;

      return {
        paymentId: reference?.replace('QM-', ''),
        status: this.mapOrangeMoneyStatus(status),
        providerTransactionId: transaction_id,
        processedAt: new Date(),
        metadata: {
          orangeTransactionId: transaction_id,
          amount: parseFloat(amount),
          currency: currency
        }
      };
    } catch (error) {
      logger.error('Orange Money webhook handling error:', error);
      throw error;
    }
  }

  async cancelPayment(transactionId) {
    try {
      const response = await axios.post(`${this.baseUrl}/transactions/${transactionId}/cancel`, {}, {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`
        }
      });

      return {
        success: response.data.status === 'SUCCESS',
        status: 'cancelled'
      };
    } catch (error) {
      logger.error('Orange Money payment cancellation error:', error);
      throw error;
    }
  }

  // Orange Money typically doesn't support refunds through API
  async refundPayment(transactionId, amount, reason) {
    throw new Error('Refunds not supported by Orange Money. Please contact support for manual refund.');
  }
}

module.exports = new OrangeMoneyProvider();
