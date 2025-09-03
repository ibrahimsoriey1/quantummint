const AWS = require('aws-sdk');
const { logger } = require('../utils/logger');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Create S3 instance
const s3 = new AWS.S3();

// S3 bucket name
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'quantummint-kyc-documents';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - File name
 * @param {String} contentType - File content type
 * @returns {Promise<Object>} - S3 upload result
 */
const uploadFile = async (fileBuffer, fileName, contentType) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'private' // Ensure documents are private
    };
    
    const result = await s3.upload(params).promise();
    logger.info(`File uploaded successfully: ${fileName}`);
    
    return result;
  } catch (error) {
    logger.error(`S3 upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Get file from S3
 * @param {String} fileName - File name
 * @returns {Promise<Object>} - S3 get object result
 */
const getFile = async (fileName) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName
    };
    
    const result = await s3.getObject(params).promise();
    logger.info(`File retrieved successfully: ${fileName}`);
    
    return result;
  } catch (error) {
    logger.error(`S3 get file error: ${error.message}`);
    throw error;
  }
};

/**
 * Generate presigned URL for file
 * @param {String} fileName - File name
 * @param {Number} expirySeconds - URL expiry in seconds
 * @returns {String} - Presigned URL
 */
const getPresignedUrl = (fileName, expirySeconds = 300) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Expires: expirySeconds
    };
    
    const url = s3.getSignedUrl('getObject', params);
    logger.info(`Presigned URL generated for: ${fileName}`);
    
    return url;
  } catch (error) {
    logger.error(`S3 presigned URL error: ${error.message}`);
    throw error;
  }
};

/**
 * Delete file from S3
 * @param {String} fileName - File name
 * @returns {Promise<Object>} - S3 delete result
 */
const deleteFile = async (fileName) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName
    };
    
    const result = await s3.deleteObject(params).promise();
    logger.info(`File deleted successfully: ${fileName}`);
    
    return result;
  } catch (error) {
    logger.error(`S3 delete file error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  s3,
  BUCKET_NAME,
  uploadFile,
  getFile,
  getPresignedUrl,
  deleteFile
};