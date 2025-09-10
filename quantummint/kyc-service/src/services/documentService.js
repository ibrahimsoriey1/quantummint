const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const Document = require('../models/Document');
const KycProfile = require('../models/KycProfile');
const logger = require('../utils/logger');

class DocumentService {
  async processDocument(documentData) {
    try {
      // Create document record
      const document = new Document(documentData);
      
      // Process image if it's an image file
      if (this.isImageFile(documentData.mimeType)) {
        await this.processImage(document);
      }

      // Extract document data based on type
      await this.extractDocumentData(document);

      // Run basic quality checks
      await this.runQualityChecks(document);

      await document.save();

      // Update KYC profile with document reference
      await this.updateProfileWithDocument(document);

      logger.info(`Document processed: ${document.documentId}`);
      return document;
    } catch (error) {
      logger.error('Process document error:', error);
      throw error;
    }
  }

  async processImage(document) {
    try {
      const imagePath = document.filePath;
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // Store image properties
      document.metadata.imageProperties = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density
      };

      // Check image quality
      const stats = await image.stats();
      document.verificationResults.quality = {
        score: this.calculateImageQualityScore(metadata, stats),
        issues: this.detectImageIssues(metadata, stats)
      };

      // Create thumbnail if needed
      const thumbnailPath = this.getThumbnailPath(document.filePath);
      await image
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      document.metadata.thumbnailPath = thumbnailPath;
    } catch (error) {
      logger.error('Process image error:', error);
      throw error;
    }
  }

  async extractDocumentData(document) {
    try {
      let extractedData = {};

      switch (document.type) {
        case 'identity_front':
        case 'identity_back':
          extractedData = await this.extractIdentityData(document);
          break;
        case 'proof_of_address':
          extractedData = await this.extractAddressData(document);
          break;
        case 'bank_statement':
          extractedData = await this.extractBankStatementData(document);
          break;
        default:
          extractedData = await this.extractGenericData(document);
      }

      document.extractedData = extractedData;
      document.verificationResults.dataExtraction = {
        confidence: extractedData.confidence || 0,
        fields: extractedData.fields || {}
      };
    } catch (error) {
      logger.error('Extract document data error:', error);
      // Don't throw error, just log it
      document.extractedData = { error: error.message };
    }
  }

  async extractIdentityData(document) {
    // Simplified OCR extraction - in production, use services like Tesseract, AWS Textract, etc.
    try {
      return {
        confidence: 0.85,
        fields: {
          documentNumber: 'EXTRACTED_NUMBER',
          name: 'EXTRACTED_NAME',
          dateOfBirth: 'EXTRACTED_DOB',
          expiryDate: 'EXTRACTED_EXPIRY',
          issuingAuthority: 'EXTRACTED_AUTHORITY'
        },
        extractedText: 'Sample extracted text from identity document'
      };
    } catch (error) {
      return { error: error.message, confidence: 0 };
    }
  }

  async extractAddressData(document) {
    try {
      return {
        confidence: 0.80,
        fields: {
          name: 'EXTRACTED_NAME',
          address: 'EXTRACTED_ADDRESS',
          city: 'EXTRACTED_CITY',
          postalCode: 'EXTRACTED_POSTAL',
          country: 'EXTRACTED_COUNTRY',
          issueDate: 'EXTRACTED_DATE'
        },
        extractedText: 'Sample extracted text from address document'
      };
    } catch (error) {
      return { error: error.message, confidence: 0 };
    }
  }

  async extractBankStatementData(document) {
    try {
      return {
        confidence: 0.75,
        fields: {
          accountHolder: 'EXTRACTED_HOLDER',
          accountNumber: 'EXTRACTED_ACCOUNT',
          bankName: 'EXTRACTED_BANK',
          statementPeriod: 'EXTRACTED_PERIOD',
          balance: 'EXTRACTED_BALANCE'
        },
        extractedText: 'Sample extracted text from bank statement'
      };
    } catch (error) {
      return { error: error.message, confidence: 0 };
    }
  }

  async extractGenericData(document) {
    try {
      return {
        confidence: 0.70,
        fields: {},
        extractedText: 'Generic document processed'
      };
    } catch (error) {
      return { error: error.message, confidence: 0 };
    }
  }

  async runQualityChecks(document) {
    try {
      const checks = [];

      // File size check
      if (document.fileSize < 50000) { // 50KB
        checks.push({
          type: 'file_size',
          passed: false,
          details: 'File size too small, may indicate poor quality'
        });
      } else {
        checks.push({
          type: 'file_size',
          passed: true,
          details: 'File size acceptable'
        });
      }

      // Image quality checks (if image)
      if (this.isImageFile(document.mimeType) && document.metadata.imageProperties) {
        const { width, height } = document.metadata.imageProperties;
        
        if (width < 800 || height < 600) {
          checks.push({
            type: 'resolution',
            passed: false,
            details: 'Image resolution too low for reliable processing'
          });
        } else {
          checks.push({
            type: 'resolution',
            passed: true,
            details: 'Image resolution acceptable'
          });
        }
      }

      // File format check
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (allowedTypes.includes(document.mimeType)) {
        checks.push({
          type: 'format',
          passed: true,
          details: 'File format supported'
        });
      } else {
        checks.push({
          type: 'format',
          passed: false,
          details: 'File format not supported'
        });
      }

      document.verificationResults.authenticity = {
        score: this.calculateAuthenticityScore(checks),
        checks
      };
    } catch (error) {
      logger.error('Quality checks error:', error);
      document.verificationResults.authenticity = {
        score: 0,
        checks: [{ type: 'error', passed: false, details: error.message }]
      };
    }
  }

  async verifyDocument(documentId, method = 'automated') {
    try {
      const document = await Document.findOne({ documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      if (method === 'automated') {
        return await this.runAutomatedVerification(document);
      } else if (method === 'manual') {
        return await this.queueForManualReview(document);
      } else {
        throw new Error('Invalid verification method');
      }
    } catch (error) {
      logger.error('Verify document error:', error);
      throw error;
    }
  }

  async runAutomatedVerification(document) {
    try {
      const verificationResults = {
        overallScore: 0,
        checks: [],
        timestamp: new Date()
      };

      // Run various automated checks
      const qualityScore = document.verificationResults.quality?.score || 0;
      const authenticityScore = document.verificationResults.authenticity?.score || 0;
      const extractionConfidence = document.verificationResults.dataExtraction?.confidence || 0;

      verificationResults.overallScore = (qualityScore + authenticityScore + extractionConfidence) / 3;

      // Determine verification status based on score
      if (verificationResults.overallScore >= 80) {
        document.verificationStatus = 'verified';
      } else if (verificationResults.overallScore >= 60) {
        document.verificationStatus = 'pending'; // Needs manual review
      } else {
        document.verificationStatus = 'rejected';
        document.rejectionReason = 'Failed automated verification checks';
      }

      document.verificationResults = {
        ...document.verificationResults,
        ...verificationResults
      };

      await document.save();
      logger.info(`Document ${documentId} automated verification completed with score: ${verificationResults.overallScore}`);

      return {
        documentId,
        verificationStatus: document.verificationStatus,
        overallScore: verificationResults.overallScore,
        method: 'automated'
      };
    } catch (error) {
      logger.error('Automated verification error:', error);
      throw error;
    }
  }

  async queueForManualReview(document) {
    try {
      document.verificationStatus = 'pending';
      document.metadata.queuedForReview = true;
      document.metadata.queuedAt = new Date();

      await document.save();
      logger.info(`Document ${document.documentId} queued for manual review`);

      return {
        documentId: document.documentId,
        verificationStatus: 'pending',
        method: 'manual',
        queuedAt: document.metadata.queuedAt
      };
    } catch (error) {
      logger.error('Queue for manual review error:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      const document = await Document.findOne({ documentId });
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete physical file
      try {
        await fs.unlink(document.filePath);
        if (document.metadata.thumbnailPath) {
          await fs.unlink(document.metadata.thumbnailPath);
        }
      } catch (fileError) {
        logger.warn('Failed to delete physical file:', fileError);
      }

      // Remove from KYC profile
      await KycProfile.updateOne(
        { profileId: document.profileId },
        { $pull: { documents: document._id } }
      );

      // Delete document record
      await Document.deleteOne({ documentId });

      logger.info(`Document deleted: ${documentId}`);
      return { deleted: true, documentId };
    } catch (error) {
      logger.error('Delete document error:', error);
      throw error;
    }
  }

  async updateProfileWithDocument(document) {
    try {
      await KycProfile.updateOne(
        { profileId: document.profileId },
        { 
          $push: { documents: document._id },
          $set: { lastUpdated: new Date() }
        }
      );
    } catch (error) {
      logger.error('Update profile with document error:', error);
      // Don't throw error as document is already created
    }
  }

  isImageFile(mimeType) {
    return mimeType && mimeType.startsWith('image/');
  }

  getThumbnailPath(originalPath) {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const name = path.basename(originalPath, ext);
    return path.join(dir, `${name}_thumb.jpg`);
  }

  calculateImageQualityScore(metadata, stats) {
    let score = 100;

    // Resolution check
    if (metadata.width < 800 || metadata.height < 600) {
      score -= 30;
    }

    // Density check
    if (metadata.density && metadata.density < 150) {
      score -= 20;
    }

    // Brightness check (simplified)
    if (stats && stats.channels) {
      const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
      if (avgBrightness < 50 || avgBrightness > 200) {
        score -= 15;
      }
    }

    return Math.max(0, score);
  }

  detectImageIssues(metadata, stats) {
    const issues = [];

    if (metadata.width < 800 || metadata.height < 600) {
      issues.push('Low resolution');
    }

    if (metadata.density && metadata.density < 150) {
      issues.push('Low DPI');
    }

    if (stats && stats.channels) {
      const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
      if (avgBrightness < 50) {
        issues.push('Image too dark');
      } else if (avgBrightness > 200) {
        issues.push('Image too bright');
      }
    }

    return issues;
  }

  calculateAuthenticityScore(checks) {
    const passedChecks = checks.filter(check => check.passed).length;
    const totalChecks = checks.length;
    
    if (totalChecks === 0) return 0;
    
    return Math.round((passedChecks / totalChecks) * 100);
  }

  async getDocumentStats(period = '30d') {
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

      const stats = await Document.aggregate([
        {
          $match: {
            uploadedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              status: '$verificationStatus'
            },
            count: { $sum: 1 },
            avgFileSize: { $avg: '$fileSize' }
          }
        }
      ]);

      return {
        period,
        statistics: stats
      };
    } catch (error) {
      logger.error('Get document stats error:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService();
