const amqp = require('amqplib');
const logger = require('../utils/logger.util');

// Environment variables
const {
  RABBITMQ_URI = 'amqp://localhost:5672'
} = process.env;

let connection;
let channel;

/**
 * Connect to RabbitMQ
 * @returns {Promise<Object>} RabbitMQ channel
 */
const connectToMessageQueue = async () => {
  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URI);
    
    // Create channel
    channel = await connection.createChannel();
    
    // Define exchanges
    await channel.assertExchange('user_events', 'topic', { durable: true });
    await channel.assertExchange('kyc_events', 'topic', { durable: true });
    
    // Define queues
    await channel.assertQueue('auth_service_user_events', { durable: true });
    await channel.assertQueue('auth_service_kyc_events', { durable: true });
    
    // Bind queues to exchanges
    await channel.bindQueue('auth_service_user_events', 'user_events', '#');
    await channel.bindQueue('auth_service_kyc_events', 'kyc_events', '#');
    
    // Handle connection close
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(connectToMessageQueue, 5000);
    });
    
    // Handle connection error
    connection.on('error', (error) => {
      logger.error(`RabbitMQ connection error: ${error.message}`);
      // Connection will be closed automatically
    });
    
    logger.info('Connected to RabbitMQ');
    
    return channel;
  } catch (error) {
    logger.error(`RabbitMQ connection error: ${error.message}`);
    // Attempt to reconnect after 5 seconds
    setTimeout(connectToMessageQueue, 5000);
    throw error;
  }
};

/**
 * Publish message to exchange
 * @param {string} exchange - Exchange name
 * @param {string} routingKey - Routing key
 * @param {Object} message - Message to publish
 * @returns {Promise<boolean>} Success status
 */
const publishToExchange = async (exchange, routingKey, message) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    
    const success = channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    
    return success;
  } catch (error) {
    logger.error(`Error publishing to exchange: ${error.message}`);
    throw error;
  }
};

/**
 * Consume messages from queue
 * @param {string} queue - Queue name
 * @param {Function} callback - Callback function to process message
 * @returns {Promise<Object>} Consumer tag
 */
const consumeFromQueue = async (queue, callback) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    
    return channel.consume(queue, (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          callback(content, msg.fields.routingKey);
          channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing message: ${error.message}`);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    logger.error(`Error consuming from queue: ${error.message}`);
    throw error;
  }
};

/**
 * Close RabbitMQ connection
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    
    if (connection) {
      await connection.close();
    }
    
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error(`Error closing RabbitMQ connection: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectToMessageQueue,
  publishToExchange,
  consumeFromQueue,
  closeConnection
};