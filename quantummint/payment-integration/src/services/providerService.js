const Provider = require('../models/Provider');
const logger = require('../utils/logger');

class ProviderService {
  async initializeDefaultProviders() {
    try {
      const defaultProviders = [
        {
          name: 'stripe',
          displayName: 'Stripe',
          isActive: true,
          supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
          supportedCountries: ['US', 'CA', 'GB', 'FR', 'DE', 'AU'],
          paymentMethods: ['card'],
          fees: {
            deposit: {
              fixed: 0.30,
              percentage: 2.9
            },
            withdrawal: {
              fixed: 0.25,
              percentage: 0
            }
          },
          limits: {
            deposit: {
              min: 1,
              max: 10000,
              daily: 50000
            },
            withdrawal: {
              min: 1,
              max: 10000,
              daily: 25000
            }
          }
        },
        {
          name: 'orange_money',
          displayName: 'Orange Money',
          isActive: true,
          supportedCurrencies: ['XOF', 'XAF', 'USD'],
          supportedCountries: ['CI', 'SN', 'ML', 'BF', 'NE', 'GN', 'CM'],
          paymentMethods: ['mobile_money'],
          fees: {
            deposit: {
              fixed: 0,
              percentage: 1.5
            },
            withdrawal: {
              fixed: 100,
              percentage: 1.0
            }
          },
          limits: {
            deposit: {
              min: 100,
              max: 1000000,
              daily: 2000000
            },
            withdrawal: {
              min: 100,
              max: 500000,
              daily: 1000000
            }
          }
        },
        {
          name: 'afrimoney',
          displayName: 'AfriMoney',
          isActive: true,
          supportedCurrencies: ['XOF', 'XAF', 'GHS', 'UGX'],
          supportedCountries: ['GH', 'UG', 'CI', 'SN', 'CM', 'BF'],
          paymentMethods: ['mobile_money'],
          fees: {
            deposit: {
              fixed: 0,
              percentage: 2.0
            },
            withdrawal: {
              fixed: 50,
              percentage: 1.5
            }
          },
          limits: {
            deposit: {
              min: 50,
              max: 2000000,
              daily: 5000000
            },
            withdrawal: {
              min: 50,
              max: 1000000,
              daily: 2000000
            }
          }
        }
      ];

      const providers = [];
      for (const providerData of defaultProviders) {
        let provider = await Provider.findOne({ name: providerData.name });
        
        if (!provider) {
          provider = new Provider(providerData);
          await provider.save();
          logger.info(`Created provider: ${providerData.name}`);
        } else {
          // Update existing provider with new data
          Object.assign(provider, providerData);
          await provider.save();
          logger.info(`Updated provider: ${providerData.name}`);
        }
        
        providers.push(provider);
      }

      return providers;
    } catch (error) {
      logger.error('Initialize providers error:', error);
      throw error;
    }
  }

  async calculateFees(providerName, amount, type, currency = 'USD') {
    try {
      const provider = await Provider.findOne({ name: providerName, isActive: true });
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or inactive`);
      }

      const feeConfig = provider.fees[type];
      if (!feeConfig) {
        throw new Error(`Fee configuration not found for type: ${type}`);
      }

      const fixedFee = feeConfig.fixed || 0;
      const percentageFee = (amount * (feeConfig.percentage || 0)) / 100;
      const totalFee = fixedFee + percentageFee;

      return {
        provider: providerName,
        type,
        amount,
        currency,
        fees: {
          fixed: fixedFee,
          percentage: percentageFee,
          total: totalFee
        },
        netAmount: amount - totalFee
      };
    } catch (error) {
      logger.error('Calculate fees error:', error);
      throw error;
    }
  }

  async getProviderLimits(providerName, type = null) {
    try {
      const provider = await Provider.findOne({ name: providerName, isActive: true });
      if (!provider) {
        throw new Error(`Provider ${providerName} not found or inactive`);
      }

      if (type) {
        const limits = provider.limits[type];
        if (!limits) {
          throw new Error(`Limits not found for type: ${type}`);
        }
        return {
          provider: providerName,
          type,
          limits
        };
      }

      return {
        provider: providerName,
        limits: provider.limits
      };
    } catch (error) {
      logger.error('Get provider limits error:', error);
      throw error;
    }
  }

  async checkAvailability(providerName, country = null, currency = null) {
    try {
      const provider = await Provider.findOne({ name: providerName });
      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      const availability = {
        provider: providerName,
        isActive: provider.isActive,
        available: provider.isActive
      };

      if (country) {
        const countrySupported = provider.supportedCountries.includes(country.toUpperCase());
        availability.countrySupported = countrySupported;
        availability.available = availability.available && countrySupported;
      }

      if (currency) {
        const currencySupported = provider.supportedCurrencies.includes(currency.toUpperCase());
        availability.currencySupported = currencySupported;
        availability.available = availability.available && currencySupported;
      }

      return availability;
    } catch (error) {
      logger.error('Check availability error:', error);
      throw error;
    }
  }

  async getActiveProviders(country = null, currency = null) {
    try {
      let query = { isActive: true };
      
      if (country) {
        query.supportedCountries = { $in: [country.toUpperCase()] };
      }
      
      if (currency) {
        query.supportedCurrencies = { $in: [currency.toUpperCase()] };
      }

      const providers = await Provider.find(query).sort({ name: 1 });
      return providers;
    } catch (error) {
      logger.error('Get active providers error:', error);
      throw error;
    }
  }

  async updateProviderStatus(providerName, isActive) {
    try {
      const provider = await Provider.findOneAndUpdate(
        { name: providerName },
        { isActive },
        { new: true }
      );

      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      logger.info(`Provider ${providerName} status updated to ${isActive ? 'active' : 'inactive'}`);
      return provider;
    } catch (error) {
      logger.error('Update provider status error:', error);
      throw error;
    }
  }

  async updateProviderConfiguration(providerName, configuration) {
    try {
      const provider = await Provider.findOneAndUpdate(
        { name: providerName },
        { configuration },
        { new: true }
      );

      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      logger.info(`Provider ${providerName} configuration updated`);
      return provider;
    } catch (error) {
      logger.error('Update provider configuration error:', error);
      throw error;
    }
  }

  async validatePaymentLimits(providerName, amount, type) {
    try {
      const limits = await this.getProviderLimits(providerName, type);
      const typeLimits = limits.limits;

      const validation = {
        valid: true,
        errors: []
      };

      if (amount < typeLimits.min) {
        validation.valid = false;
        validation.errors.push(`Amount ${amount} is below minimum limit of ${typeLimits.min}`);
      }

      if (amount > typeLimits.max) {
        validation.valid = false;
        validation.errors.push(`Amount ${amount} exceeds maximum limit of ${typeLimits.max}`);
      }

      // Note: Daily limit validation would require checking existing transactions
      // This is a simplified version
      validation.limits = typeLimits;

      return validation;
    } catch (error) {
      logger.error('Validate payment limits error:', error);
      throw error;
    }
  }

  async getProviderStats(providerName, period = '30d') {
    try {
      const Payment = require('../models/Payment');
      
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

      const stats = await Payment.aggregate([
        {
          $match: {
            provider: providerName,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              status: '$status',
              type: '$type'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalFees: { $sum: '$fees.amount' }
          }
        }
      ]);

      return {
        provider: providerName,
        period,
        statistics: stats
      };
    } catch (error) {
      logger.error('Get provider stats error:', error);
      throw error;
    }
  }
}

module.exports = new ProviderService();
