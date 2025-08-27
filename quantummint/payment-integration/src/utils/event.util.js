const amqp = require('amqplib');
const logger = require('./logger.util');

let channel = null;
const EXCHANGE_NAME = 'quantummint_events';

/**
 * Initialize RabbitMQ connection
 * @returns {Promise<void>}
 */
async function initializeRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost');
    channel = await connection.createChannel();
    
    // Create exchange if it doesn't exist
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    
    logger.info('Connected to RabbitMQ');
    
    // Handle connection close
    connection.on('close', () => {
      logger.error('RabbitMQ connection closed');
      setTimeout(initializeRabbitMQ, 5000);
    });
    
    // Handle errors
    connection.on('error', (error) => {
      logger.error(`RabbitMQ connection error: ${error.message}`);
      setTimeout(initializeRabbitMQ, 5000);
    });
  } catch (error) {
    logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
    setTimeout(initializeRabbitMQ, 5000);
  }
}

/**
 * Publish an event to the message queue
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 * @returns {Promise<boolean>} Success status
 */
async function publishEvent(eventType, data) {
  try {
    if (!channel) {
      logger.error('RabbitMQ channel not initialized');
      return false;
    }
    
    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString()
    };
    
    const success = channel.publish(
      EXCHANGE_NAME,
      eventType,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
    
    if (success) {
      logger.info(`Event published: ${eventType}`);
    } else {
      logger.warn(`Failed to publish event: ${eventType}`);
    }
    
    return success;
  } catch (error) {
    logger.error(`Error publishing event: ${error.message}`);
    return false;
  }
}

/**
 * Subscribe to events
 * @param {string} eventType - Event type to subscribe to
 * @param {Function} handler - Event handler function
 * @returns {Promise<void>}
 */
async function subscribeToEvents(eventType, handler) {
  try {
    if (!channel) {
      logger.error('RabbitMQ channel not initialized');
      return;
    }
    
    // Create queue for this service
    const { queue } = await channel.assertQueue('payment_integration_service', { durable: true });
    
    // Bind queue to exchange with routing key
    await channel.bindQueue(queue, EXCHANGE_NAME, eventType);
    
    // Consume messages
    await channel.consume(queue, async (message) => {
      if (!message) return;
      
      try {
        const payload = JSON.parse(message.content.toString());
        logger.info(`Received event: ${payload.eventType}`);
        
        // Process event
        await handler(payload.data);
        
        // Acknowledge message
        channel.ack(message);
      } catch (error) {
        logger.error(`Error processing event: ${error.message}`);
        // Reject message and requeue
        channel.nack(message, false, true);
      }
    });
    
    logger.info(`Subscribed to event: ${eventType}`);
  } catch (error) {
    logger.error(`Error subscribing to events: ${error.message}`);
  }
}

module.exports = {
  initializeRabbitMQ,
  publishEvent,
  subscribeToEvents
};