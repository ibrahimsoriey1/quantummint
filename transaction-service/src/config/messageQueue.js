const amqp = require('amqplib');
const { logger } = require('../utils/logger');
require('dotenv').config();

// RabbitMQ configuration
const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'quantummint_exchange';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'transaction_queue';

// Global connection and channel variables
let connection;
let channel;

/**
 * Setup message queue connection
 */
const setupMessageQueue = async () => {
  try {
    // Connect to RabbitMQ
    connection = await amqp.connect(RABBITMQ_URI);
    channel = await connection.createChannel();
    
    // Setup exchange and queue
    await channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });
    
    // Bind queue to exchange with routing keys
    await channel.bindQueue(RABBITMQ_QUEUE, RABBITMQ_EXCHANGE, 'transaction.#');
    await channel.bindQueue(RABBITMQ_QUEUE, RABBITMQ_EXCHANGE, 'generation.completed');
    await channel.bindQueue(RABBITMQ_QUEUE, RABBITMQ_EXCHANGE, 'payment.#');
    
    logger.info(`Connected to RabbitMQ: ${RABBITMQ_URI}`);
    
    // Setup event handlers
    connection.on('error', (err) => {
      logger.error(`RabbitMQ connection error: ${err.message}`);
      setTimeout(setupMessageQueue, 5000); // Try to reconnect after 5 seconds
    });
    
    connection.on('close', () => {
      logger.error('RabbitMQ connection closed');
      setTimeout(setupMessageQueue, 5000); // Try to reconnect after 5 seconds
    });
    
    return { connection, channel };
  } catch (error) {
    logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
    setTimeout(setupMessageQueue, 5000); // Try to reconnect after 5 seconds
  }
};

/**
 * Publish message to exchange
 * @param {String} routingKey - Routing key
 * @param {Object} message - Message to publish
 */
const publishMessage = async (routingKey, message) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not established');
    }
    
    await channel.publish(
      RABBITMQ_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    
    logger.info(`Message published to ${routingKey}: ${JSON.stringify(message)}`);
  } catch (error) {
    logger.error(`Failed to publish message: ${error.message}`);
    throw error;
  }
};

/**
 * Consume messages from queue
 * @param {Function} callback - Callback function to process messages
 */
const consumeMessages = async (callback) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not established');
    }
    
    await channel.consume(RABBITMQ_QUEUE, (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        
        logger.info(`Received message from ${routingKey}: ${JSON.stringify(content)}`);
        
        // Process message
        callback(content, routingKey)
          .then(() => {
            channel.ack(msg);
          })
          .catch((error) => {
            logger.error(`Error processing message: ${error.message}`);
            channel.nack(msg, false, false); // Don't requeue
          });
      }
    });
    
    logger.info(`Consuming messages from ${RABBITMQ_QUEUE}`);
  } catch (error) {
    logger.error(`Failed to consume messages: ${error.message}`);
    throw error;
  }
};

module.exports = {
  setupMessageQueue,
  publishMessage,
  consumeMessages
};