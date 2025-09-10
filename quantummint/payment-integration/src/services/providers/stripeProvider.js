const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../../utils/logger');

class StripeProvider {
  constructor() {
    this.name = 'stripe';
  }

  async processPayment(payment, paymentMethodDetails) {
    try {
      const { amount, currency, description, metadata } = payment;
      const { paymentMethodId, customerId } = paymentMethodDetails;

      let paymentIntent;

      if (payment.type === 'deposit') {
        // Create payment intent for deposit
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          payment_method: paymentMethodId,
          customer: customerId,
          description: description || `Deposit to QuantumMint - ${payment.paymentId}`,
          metadata: {
            paymentId: payment.paymentId,
            userId: payment.userId,
            ...metadata
          },
          confirm: true,
          return_url: `${process.env.FRONTEND_URL}/payment/return`
        });

        return {
          transactionId: paymentIntent.id,
          status: this.mapStripeStatus(paymentIntent.status),
          metadata: {
            stripePaymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret
          }
        };
      } else if (payment.type === 'withdrawal') {
        // Create transfer for withdrawal (requires Stripe Connect)
        const transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          destination: paymentMethodDetails.accountId,
          description: description || `Withdrawal from QuantumMint - ${payment.paymentId}`,
          metadata: {
            paymentId: payment.paymentId,
            userId: payment.userId,
            ...metadata
          }
        });

        return {
          transactionId: transfer.id,
          status: 'completed',
          metadata: {
            stripeTransferId: transfer.id
          }
        };
      }

      throw new Error(`Unsupported payment type: ${payment.type}`);
    } catch (error) {
      logger.error('Stripe payment processing error:', error);
      return {
        status: 'failed',
        failureReason: error.message
      };
    }
  }

  async cancelPayment(transactionId) {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(transactionId);
      return {
        success: true,
        status: this.mapStripeStatus(paymentIntent.status)
      };
    } catch (error) {
      logger.error('Stripe payment cancellation error:', error);
      throw error;
    }
  }

  async refundPayment(transactionId, amount, reason) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason || 'requested_by_customer',
        metadata: {
          refundReason: reason
        }
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };
    } catch (error) {
      logger.error('Stripe refund error:', error);
      throw error;
    }
  }

  async createCustomer(userDetails) {
    try {
      const customer = await stripe.customers.create({
        email: userDetails.email,
        name: userDetails.name,
        phone: userDetails.phone,
        metadata: {
          userId: userDetails.userId
        }
      });

      return {
        customerId: customer.id,
        customer
      };
    } catch (error) {
      logger.error('Stripe customer creation error:', error);
      throw error;
    }
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const paymentMethod = await stripe.paymentMethods.create({
        type: paymentMethodData.type,
        card: paymentMethodData.card,
        billing_details: paymentMethodData.billingDetails
      });

      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });

      return {
        paymentMethodId: paymentMethod.id,
        paymentMethod
      };
    } catch (error) {
      logger.error('Stripe payment method creation error:', error);
      throw error;
    }
  }

  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Stripe get payment methods error:', error);
      throw error;
    }
  }

  mapStripeStatus(stripeStatus) {
    const statusMap = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'processing': 'processing',
      'requires_capture': 'processing',
      'canceled': 'cancelled',
      'succeeded': 'completed'
    };

    return statusMap[stripeStatus] || 'pending';
  }

  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailure(event.data.object);
        case 'payment_intent.canceled':
          return await this.handlePaymentCancellation(event.data.object);
        default:
          logger.info(`Unhandled Stripe webhook event: ${event.type}`);
          return { processed: false };
      }
    } catch (error) {
      logger.error('Stripe webhook handling error:', error);
      throw error;
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    return {
      paymentId: paymentIntent.metadata.paymentId,
      status: 'completed',
      providerTransactionId: paymentIntent.id,
      processedAt: new Date(),
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      }
    };
  }

  async handlePaymentFailure(paymentIntent) {
    return {
      paymentId: paymentIntent.metadata.paymentId,
      status: 'failed',
      providerTransactionId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        errorCode: paymentIntent.last_payment_error?.code
      }
    };
  }

  async handlePaymentCancellation(paymentIntent) {
    return {
      paymentId: paymentIntent.metadata.paymentId,
      status: 'cancelled',
      providerTransactionId: paymentIntent.id,
      metadata: {
        stripePaymentIntentId: paymentIntent.id
      }
    };
  }
}

module.exports = new StripeProvider();
