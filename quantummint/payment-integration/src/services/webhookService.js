const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const Payment = require('../models/Payment');
const stripeProvider = require('./providers/stripeProvider');
const orangeMoneyProvider = require('./providers/orangeMoneyProvider');
const afriMoneyProvider = require('./providers/afriMoneyProvider');
const logger = require('../utils/logger');

class WebhookService {
  constructor() {
    this.providers = {
      stripe: stripeProvider,
      orange_money: orangeMoneyProvider,
      afrimoney: afriMoneyProvider
    };
  }

  async verifyStripeSignature(payload, signature) {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('Stripe webhook secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.split('=')[1];
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );
    } catch (error) {
      logger.error('Stripe signature verification error:', error);
      return false;
    }
  }

  async verifyOrangeMoneySignature(payload, signature) {
    try {
      const secret = process.env.ORANGE_MONEY_SECRET;
      if (!secret) {
        logger.warn('Orange Money secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error('Orange Money signature verification error:', error);
      return false;
    }
  }

  async verifyAfriMoneySignature(payload, signature) {
    try {
      const secret = process.env.AFRIMONEY_SECRET;
      if (!secret) {
        logger.warn('AfriMoney secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error('AfriMoney signature verification error:', error);
      return false;
    }
  }

  async processWebhook(webhookId) {
    try {
      const webhook = await Webhook.findById(webhookId);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      if (webhook.status !== 'received') {
        logger.info(`Webhook ${webhookId} already processed with status: ${webhook.status}`);
        return webhook;
      }

      webhook.status = 'processing';
      await webhook.save();

      const provider = this.providers[webhook.provider];
      if (!provider || !provider.handleWebhook) {
        throw new Error(`Provider ${webhook.provider} does not support webhook handling`);
      }

      // Process webhook with provider
      const result = await provider.handleWebhook(webhook.payload);
      
      if (result.paymentId) {
        // Update payment status
        const payment = await Payment.findOne({ paymentId: result.paymentId });
        if (payment) {
          payment.status = result.status;
          payment.webhookReceived = true;
          
          if (result.processedAt) {
            payment.processedAt = result.processedAt;
          }
          
          if (result.failureReason) {
            payment.failureReason = result.failureReason;
          }
          
          if (result.metadata) {
            payment.metadata = { ...payment.metadata, ...result.metadata };
          }

          await payment.save();
          
          // Update webhook with payment reference
          webhook.paymentId = result.paymentId;
          webhook.providerTransactionId = result.providerTransactionId;
          
          logger.info(`Payment ${result.paymentId} updated from webhook`);
        } else {
          logger.warn(`Payment not found for webhook: ${result.paymentId}`);
        }
      }

      webhook.status = 'processed';
      webhook.processedAt = new Date();
      await webhook.save();

      logger.info(`Webhook ${webhookId} processed successfully`);
      return webhook;
    } catch (error) {
      logger.error(`Webhook processing error for ${webhookId}:`, error);
      
      // Update webhook status to failed
      try {
        const webhook = await Webhook.findById(webhookId);
        if (webhook) {
          webhook.status = 'failed';
          webhook.failureReason = error.message;
          webhook.retryCount += 1;
          await webhook.save();
        }
      } catch (updateError) {
        logger.error('Failed to update webhook status:', updateError);
      }
      
      throw error;
    }
  }

  async retryWebhook(webhookId) {
    try {
      const webhook = await Webhook.findOne({ webhookId });
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      if (webhook.retryCount >= webhook.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      if (webhook.status === 'processed') {
        throw new Error('Webhook already processed successfully');
      }

      // Reset status to received for reprocessing
      webhook.status = 'received';
      webhook.retryCount += 1;
      await webhook.save();

      // Process webhook asynchronously
      this.processWebhook(webhook._id).catch(error => {
        logger.error('Webhook retry processing error:', error);
      });

      return {
        webhookId: webhook.webhookId,
        retryCount: webhook.retryCount,
        maxRetries: webhook.maxRetries,
        status: 'retry_initiated'
      };
    } catch (error) {
      logger.error('Retry webhook error:', error);
      throw error;
    }
  }

  async getWebhookStats(provider = null, period = '30d') {
    try {
      let startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const matchQuery = {
        createdAt: { $gte: startDate }
      };

      if (provider) {
        matchQuery.provider = provider;
      }

      const stats = await Webhook.aggregate([
        {
          $match: matchQuery
        },
        {
          $group: {
            _id: {
              provider: '$provider',
              status: '$status'
            },
            count: { $sum: 1 },
            avgRetryCount: { $avg: '$retryCount' }
          }
        }
      ]);

      return {
        period,
        provider,
        statistics: stats
      };
    } catch (error) {
      logger.error('Get webhook stats error:', error);
      throw error;
    }
  }

  async cleanupOldWebhooks(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Webhook.deleteMany({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['processed', 'ignored'] }
      });

      logger.info(`Cleaned up ${result.deletedCount} old webhooks`);
      return result;
    } catch (error) {
      logger.error('Cleanup old webhooks error:', error);
      throw error;
    }
  }

  async getFailedWebhooks(limit = 100) {
    try {
      const failedWebhooks = await Webhook.find({
        status: 'failed',
        retryCount: { $lt: '$maxRetries' }
      })
      .sort({ createdAt: -1 })
      .limit(limit);

      return failedWebhooks;
    } catch (error) {
      logger.error('Get failed webhooks error:', error);
      throw error;
    }
  }

  async retryFailedWebhooks() {
    try {
      const failedWebhooks = await this.getFailedWebhooks();
      const results = [];

      for (const webhook of failedWebhooks) {
        try {
          const result = await this.retryWebhook(webhook.webhookId);
          results.push({
            webhookId: webhook.webhookId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            webhookId: webhook.webhookId,
            success: false,
            error: error.message
          });
        }
      }

      logger.info(`Retried ${results.length} failed webhooks`);
      return results;
    } catch (error) {
      logger.error('Retry failed webhooks error:', error);
      throw error;
    }
  }
}

module.exports = new WebhookService();
