const { publishToExchange } = require('../config/rabbitmq.config');
const logger = require('./logger.util');

/**
 * Publish event to appropriate exchange
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 * @returns {Promise<boolean>} Success status
 */
exports.publishEvent = async (eventType, data) => {
  try {
    // Determine exchange and routing key based on event type
    let exchange;
    let routingKey;
    
    if (eventType.startsWith('user.')) {
      exchange = 'user_events';
      routingKey = eventType;
    } else if (eventType.startsWith('kyc.')) {
      exchange = 'kyc_events';
      routingKey = eventType;
    } else {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    
    // Add timestamp to event data
    const eventData = {
      ...data,
      eventType,
      timestamp: new Date().toISOString()
    };
    
    // Publish event
    const success = await publishToExchange(exchange, routingKey, eventData);
    
    if (success) {
      logger.debug(`Published event: ${eventType}`, { eventType, data });
    } else {
      logger.warn(`Failed to publish event: ${eventType}`, { eventType, data });
    }
    
    return success;
  } catch (error) {
    logger.error(`Error publishing event: ${error.message}`, { eventType, data, error });
    throw error;
  }
};

/**
 * Subscribe to events
 * @param {string} eventType - Event type to subscribe to
 * @param {Function} handler - Event handler function
 */
exports.subscribeToEvent = async (eventType, handler) => {
  try {
    // Determine queue based on event type
    let queue;
    
    if (eventType.startsWith('user.')) {
      queue = 'auth_service_user_events';
    } else if (eventType.startsWith('kyc.')) {
      queue = 'auth_service_kyc_events';
    } else {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    
    // Create event handler
    const eventHandler = (data, routingKey) => {
      if (routingKey === eventType) {
        handler(data);
      }
    };
    
    // Subscribe to queue
    await consumeFromQueue(queue, eventHandler);
    
    logger.info(`Subscribed to event: ${eventType}`);
  } catch (error) {
    logger.error(`Error subscribing to event: ${error.message}`, { eventType, error });
    throw error;
  }
};