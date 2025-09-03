const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { logger } = require('../utils/logger');
const { ApiError } = require('../middleware/errorHandler');
require('dotenv').config();

/**
 * Stripe payment provider implementation
 */
class StripeProvider {
  /**
   * Initialize Stripe provider
   */
  constructor() {
    this.name = 'Stripe';
    this.code = 'stripe';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create a payment intent
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Payment intent
   */
  async createPayment(data) {
    try {
      const { amount, currency = 'usd', description, metadata = {}, paymentMethod } = data;
      
      // Convert amount to cents (Stripe requires integer amounts)
      const amountInCents = Math.round(amount * 100);
      
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        description,
        metadata,
        payment_method: paymentMethod,
        confirmation_method: 'manual',
        confirm: true,
        return_url: data.returnUrl || process.env.WEBHOOK_BASE_URL
      });
      
      return {
        success: true,
        providerPaymentId: paymentIntent.id,
        providerReference: paymentIntent.id,
        status: this.mapPaymentStatus(paymentIntent.status),
        providerResponse: paymentIntent,
        nextAction: paymentIntent.next_action
      };
    } catch (error) {
      logger.error(`Stripe payment creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create Stripe payment: ${error.message}`);
    }
  }

  /**
   * Create a withdrawal (payout)
   * @param {Object} data - Withdrawal data
   * @returns {Promise<Object>} - Payout
   */
  async createWithdrawal(data) {
    try {
      const { amount, currency = 'usd', description, metadata = {}, destination } = data;
      
      // Convert amount to cents (Stripe requires integer amounts)
      const amountInCents = Math.round(amount * 100);
      
      // Create transfer to connected account or payout to bank account
      let payout;
      
      if (destination.type === 'bank_account') {
        // Create payout to bank account
        payout = await stripe.payouts.create({
          amount: amountInCents,
          currency: currency.toLowerCase(),
          description,
          metadata,
          destination: destination.id,
          method: 'standard'
        });
      } else if (destination.type === 'card') {
        // Create payout to card
        payout = await stripe.payouts.create({
          amount: amountInCents,
          currency: currency.toLowerCase(),
          description,
          metadata,
          destination: destination.id,
          method: 'instant'
        });
      } else {
        throw new ApiError(400, 'Invalid destination type');
      }
      
      return {
        success: true,
        providerPaymentId: payout.id,
        providerReference: payout.id,
        status: this.mapPayoutStatus(payout.status),
        providerResponse: payout
      };
    } catch (error) {
      logger.error(`Stripe withdrawal creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create Stripe withdrawal: ${error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} - Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
      
      return {
        success: true,
        status: this.mapPaymentStatus(paymentIntent.status),
        providerResponse: paymentIntent
      };
    } catch (error) {
      logger.error(`Stripe payment status error: ${error.message}`);
      throw new ApiError(500, `Failed to get Stripe payment status: ${error.message}`);
    }
  }

  /**
   * Get withdrawal status
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Withdrawal status
   */
  async getWithdrawalStatus(withdrawalId) {
    try {
      const payout = await stripe.payouts.retrieve(withdrawalId);
      
      return {
        success: true,
        status: this.mapPayoutStatus(payout.status),
        providerResponse: payout
      };
    } catch (error) {
      logger.error(`Stripe withdrawal status error: ${error.message}`);
      throw new ApiError(500, `Failed to get Stripe withdrawal status: ${error.message}`);
    }
  }

  /**
   * Refund payment
   * @param {String} paymentId - Payment ID
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Refund
   */
  async refundPayment(paymentId, data = {}) {
    try {
      const { amount, reason = 'requested_by_customer', metadata = {} } = data;
      
      // Convert amount to cents if provided
      const refundData = {
        payment_intent: paymentId,
        reason,
        metadata
      };
      
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }
      
      const refund = await stripe.refunds.create(refundData);
      
      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        providerResponse: refund
      };
    } catch (error) {
      logger.error(`Stripe refund error: ${error.message}`);
      throw new ApiError(500, `Failed to refund Stripe payment: ${error.message}`);
    }
  }

  /**
   * Cancel withdrawal
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Cancelled withdrawal
   */
  async cancelWithdrawal(withdrawalId) {
    try {
      const payout = await stripe.payouts.cancel(withdrawalId);
      
      return {
        success: true,
        status: this.mapPayoutStatus(payout.status),
        providerResponse: payout
      };
    } catch (error) {
      logger.error(`Stripe withdrawal cancellation error: ${error.message}`);
      throw new ApiError(500, `Failed to cancel Stripe withdrawal: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Object} - Event
   */
  verifyWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      
      return {
        success: true,
        event
      };
    } catch (error) {
      logger.error(`Stripe webhook verification error: ${error.message}`);
      throw new ApiError(400, `Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event
   * @returns {Object} - Processed event
   */
  processWebhookEvent(event) {
    try {
      const eventType = event.type;
      const eventData = event.data.object;
      let paymentId = null;
      let status = null;
      
      // Process different event types
      switch (eventType) {
        case 'payment_intent.succeeded':
          paymentId = eventData.id;
          status = 'completed';
          break;
        case 'payment_intent.payment_failed':
          paymentId = eventData.id;
          status = 'failed';
          break;
        case 'payment_intent.canceled':
          paymentId = eventData.id;
          status = 'cancelled';
          break;
        case 'payout.paid':
          paymentId = eventData.id;
          status = 'completed';
          break;
        case 'payout.failed':
          paymentId = eventData.id;
          status = 'failed';
          break;
        case 'payout.canceled':
          paymentId = eventData.id;
          status = 'cancelled';
          break;
        default:
          // Unhandled event type
          return {
            success: true,
            handled: false,
            eventType,
            message: `Unhandled event type: ${eventType}`
          };
      }
      
      return {
        success: true,
        handled: true,
        eventType,
        paymentId,
        status,
        eventData
      };
    } catch (error) {
      logger.error(`Stripe webhook processing error: ${error.message}`);
      throw new ApiError(500, `Failed to process Stripe webhook: ${error.message}`);
    }
  }

  /**
   * Map Stripe payment status to internal status
   * @param {String} stripeStatus - Stripe payment status
   * @returns {String} - Internal status
   */
  mapPaymentStatus(stripeStatus) {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'processing':
        return 'processing';
      case 'requires_capture':
      case 'succeeded':
        return 'completed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'failed';
    }
  }

  /**
   * Map Stripe payout status to internal status
   * @param {String} stripeStatus - Stripe payout status
   * @returns {String} - Internal status
   */
  mapPayoutStatus(stripeStatus) {
    switch (stripeStatus) {
      case 'pending':
      case 'in_transit':
        return 'processing';
      case 'paid':
        return 'completed';
      case 'canceled':
        return 'cancelled';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Calculate payment fee
   * @param {Number} amount - Payment amount
   * @param {String} currency - Currency
   * @returns {Number} - Fee amount
   */
  calculateFee(amount, currency = 'usd') {
    // Stripe typically charges 2.9% + $0.30 per transaction
    return (amount * 0.029) + 0.30;
  }
}

module.exports = new StripeProvider();