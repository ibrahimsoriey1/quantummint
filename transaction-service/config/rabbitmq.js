const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    
    connection = await amqp.connect(rabbitmqUrl);
    logger.info('RabbitMQ connected');

    channel = await connection.createChannel();
    logger.info('RabbitMQ channel created');

    // Define exchanges
    await channel.assertExchange('transactions', 'topic', { durable: true });
    await channel.assertExchange('balance_updates', 'topic', { durable: true });
    await channel.assertExchange('compliance_checks', 'topic', { durable: true });
    await channel.assertExchange('notifications', 'topic', { durable: true });

    // Define queues
    await channel.assertQueue('transaction_processing', { durable: true });
    await channel.assertQueue('balance_updates', { durable: true });
    await channel.assertQueue('compliance_checks', { durable: true });
    await channel.assertQueue('transaction_notifications', { durable: true });

    // Bind queues to exchanges
    await channel.bindQueue('transaction_processing', 'transactions', 'create');
    await channel.bindQueue('transaction_processing', 'transactions', 'update');
    await channel.bindQueue('balance_updates', 'balance_updates', 'update');
    await channel.bindQueue('compliance_checks', 'compliance_checks', 'verify');
    await channel.bindQueue('transaction_notifications', 'notifications', 'transaction');

    // Connection event listeners
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

    channel.on('error', (err) => {
      logger.error('RabbitMQ channel error:', err);
    });

    channel.on('return', (msg) => {
      logger.warn('RabbitMQ message returned:', msg);
    });

    logger.info('RabbitMQ setup completed');

  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    throw error;
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

const getConnection = () => {
  if (!connection) {
    throw new Error('RabbitMQ connection not initialized');
  }
  return connection;
};

const publishMessage = async (exchange, routingKey, message, options = {}) => {
  try {
    const channel = getChannel();
    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    const result = await channel.publish(exchange, routingKey, messageBuffer, {
      persistent: true,
      mandatory: true,
      ...options
    });

    if (result) {
      logger.info(`Message published to ${exchange}:${routingKey}`);
    } else {
      logger.warn(`Message not published to ${exchange}:${routingKey}`);
    }

    return result;
  } catch (error) {
    logger.error('Error publishing message:', error);
    throw error;
  }
};

const consumeMessage = async (queue, callback, options = {}) => {
  try {
    const channel = getChannel();
    
    await channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content, msg);
          
          // Acknowledge message
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          
          // Reject message and requeue if it's a processing error
          channel.nack(msg, false, true);
        }
      }
    }, {
      noAck: false,
      ...options
    });

    logger.info(`Started consuming from queue: ${queue}`);
  } catch (error) {
    logger.error('Error setting up consumer:', error);
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
    logger.error('Error closing RabbitMQ:', error);
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
