const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    const username = process.env.RABBITMQ_USERNAME || 'guest';
    const password = process.env.RABBITMQ_PASSWORD || 'guest';
    
    // Create connection with credentials
    const url = new URL(rabbitmqUrl);
    url.username = username;
    url.password = password;
    
    connection = await amqp.connect(url.toString());
    logger.info('RabbitMQ connected');
    
    // Create channel
    channel = await connection.createChannel();
    logger.info('RabbitMQ channel created');
    
    // Define exchanges
    await channel.assertExchange('money.generation', 'topic', { durable: true });
    await channel.assertExchange('wallet.operations', 'topic', { durable: true });
    await channel.assertExchange('transactions', 'topic', { durable: true });
    
    // Define queues
    await channel.assertQueue('generation.requests', { durable: true });
    await channel.assertQueue('generation.results', { durable: true });
    await channel.assertQueue('wallet.updates', { durable: true });
    await channel.assertQueue('transaction.notifications', { durable: true });
    
    // Bind queues to exchanges
    await channel.bindQueue('generation.requests', 'money.generation', 'request');
    await channel.bindQueue('generation.results', 'money.generation', 'result');
    await channel.bindQueue('wallet.updates', 'wallet.operations', 'update');
    await channel.bindQueue('transaction.notifications', 'transactions', 'notification');
    
    // Handle connection events
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });
    
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });
    
    connection.on('reconnect', () => {
      logger.info('RabbitMQ reconnected');
    });
    
    // Handle channel events
    channel.on('error', (err) => {
      logger.error('RabbitMQ channel error:', err);
    });
    
    channel.on('close', () => {
      logger.warn('RabbitMQ channel closed');
    });
    
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    throw error;
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Call connectRabbitMQ() first.');
  }
  return channel;
};

const getConnection = () => {
  if (!connection) {
    throw new Error('RabbitMQ connection not initialized. Call connectRabbitMQ() first.');
  }
  return connection;
};

const publishMessage = async (exchange, routingKey, message, options = {}) => {
  try {
    const ch = getChannel();
    const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(JSON.stringify(message));
    
    const result = await ch.publish(exchange, routingKey, messageBuffer, {
      persistent: true,
      ...options
    });
    
    if (result) {
      logger.info(`Message published to ${exchange} with routing key ${routingKey}`);
    } else {
      logger.warn(`Message not published to ${exchange} with routing key ${routingKey}`);
    }
    
    return result;
  } catch (error) {
    logger.error('Error publishing message:', error);
    throw error;
  }
};

const consumeMessage = async (queue, callback, options = {}) => {
  try {
    const ch = getChannel();
    
    await ch.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content, msg);
          
          // Acknowledge message
          ch.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          
          // Reject message and requeue if it's a processing error
          ch.nack(msg, false, true);
        }
      }
    }, {
      noAck: false,
      ...options
    });
    
    logger.info(`Started consuming messages from queue: ${queue}`);
  } catch (error) {
    logger.error('Error setting up message consumer:', error);
    throw error;
  }
};

const closeRabbitMQ = async () => {
  try {
    if (channel) {
      await channel.close();
      logger.info('RabbitMQ channel closed');
    }
    
    if (connection) {
      await connection.close();
      logger.info('RabbitMQ connection closed');
    }
  } catch (error) {
    logger.error('Error closing RabbitMQ connections:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeRabbitMQ();
});

process.on('SIGTERM', async () => {
  await closeRabbitMQ();
});

module.exports = {
  connectRabbitMQ,
  getChannel,
  getConnection,
  publishMessage,
  consumeMessage,
  closeRabbitMQ
};
