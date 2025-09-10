const Verification = require('../models/Verification');
const KycProfile = require('../models/KycProfile');
const Document = require('../models/Document');
const documentService = require('./documentService');
const complianceService = require('./complianceService');
const logger = require('../utils/logger');

class VerificationService {
  async startVerification(verificationData) {
    try {
      // Create verification record
      const verification = new Verification(verificationData);
      
      // Initialize verification steps based on type
      verification.steps = this.getVerificationSteps(verificationData.type);
      
      // Add initial timeline entry
      verification.timeline.push({
        event: 'verification_started',
        timestamp: new Date(),
        details: `${verificationData.type} verification initiated`,
        performedBy: 'system'
      });

      await verification.save();

      // Start first step automatically if it's automated
      if (verification.method === 'automated' || verification.method === 'comprehensive') {
        await this.processNextStep(verification._id);
      }

      logger.info(`Verification started: ${verification.verificationId}`);
      return verification;
    } catch (error) {
      logger.error('Start verification error:', error);
      throw error;
    }
  }

  async updateVerificationStep(verificationId, stepData) {
    try {
      const verification = await Verification.findOne({ verificationId });
      if (!verification) {
        throw new Error('Verification not found');
      }

      // Find and update the step
      const stepIndex = verification.steps.findIndex(step => step.stepId === stepData.stepId);
      if (stepIndex === -1) {
        // Add new step if it doesn't exist
        verification.steps.push({
          stepId: stepData.stepId,
          name: stepData.name,
          status: stepData.status,
          completedAt: stepData.status === 'completed' ? new Date() : null,
          data: stepData.data || {},
          errors: stepData.errors || []
        });
      } else {
        // Update existing step
        verification.steps[stepIndex] = {
          ...verification.steps[stepIndex],
          ...stepData,
          completedAt: stepData.status === 'completed' ? new Date() : verification.steps[stepIndex].completedAt
        };
      }

      // Add timeline entry
      verification.timeline.push({
        event: 'step_updated',
        timestamp: new Date(),
        details: `Step ${stepData.name} ${stepData.status}`,
        performedBy: 'system'
      });

      await verification.save();

      // Process next step if current step is completed
      if (stepData.status === 'completed') {
        await this.processNextStep(verification._id);
      }

      return verification;
    } catch (error) {
      logger.error('Update verification step error:', error);
      throw error;
    }
  }

  async processNextStep(verificationId) {
    try {
      const verification = await Verification.findById(verificationId);
      if (!verification) {
        throw new Error('Verification not found');
      }

      // Find next pending step
      const nextStep = verification.steps.find(step => step.status === 'pending');
      if (!nextStep) {
        // All steps completed, finalize verification
        return await this.finalizeVerification(verificationId);
      }

      // Process the next step based on its type
      await this.executeStep(verification, nextStep);

      return verification;
    } catch (error) {
      logger.error('Process next step error:', error);
      throw error;
    }
  }

  async executeStep(verification, step) {
    try {
      verification.status = 'in_progress';
      await verification.save();

      switch (step.stepId) {
        case 'document_verification':
          await this.executeDocumentVerification(verification, step);
          break;
        case 'identity_extraction':
          await this.executeIdentityExtraction(verification, step);
          break;
        case 'address_verification':
          await this.executeAddressVerification(verification, step);
          break;
        case 'compliance_check':
          await this.executeComplianceCheck(verification, step);
          break;
        case 'biometric_verification':
          await this.executeBiometricVerification(verification, step);
          break;
        case 'manual_review':
          await this.queueForManualReview(verification, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.stepId}`);
      }
    } catch (error) {
      logger.error(`Execute step ${step.stepId} error:`, error);
      
      // Mark step as failed
      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      if (stepIndex >= 0) {
        verification.steps[stepIndex].status = 'failed';
        verification.steps[stepIndex].errors.push(error.message);
      }
      
      verification.status = 'failed';
      await verification.save();
      
      throw error;
    }
  }

  async executeDocumentVerification(verification, step) {
    try {
      const documents = await Document.find({ profileId: verification.profileId });
      const results = [];

      for (const document of documents) {
        const verificationResult = await documentService.runAutomatedVerification(document);
        results.push(verificationResult);
      }

      // Update step with results
      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'completed';
      verification.steps[stepIndex].completedAt = new Date();
      verification.steps[stepIndex].data = { documentResults: results };

      await verification.save();
    } catch (error) {
      throw new Error(`Document verification failed: ${error.message}`);
    }
  }

  async executeIdentityExtraction(verification, step) {
    try {
      const profile = await KycProfile.findOne({ profileId: verification.profileId });
      const identityDocs = await Document.find({ 
        profileId: verification.profileId, 
        type: { $in: ['identity_front', 'identity_back'] }
      });

      const extractedData = {};
      for (const doc of identityDocs) {
        if (doc.extractedData && doc.extractedData.fields) {
          Object.assign(extractedData, doc.extractedData.fields);
        }
      }

      // Compare extracted data with profile data
      const comparison = this.compareIdentityData(profile.personalInfo, extractedData);

      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'completed';
      verification.steps[stepIndex].completedAt = new Date();
      verification.steps[stepIndex].data = { 
        extractedData, 
        comparison,
        matchScore: comparison.overallScore
      };

      await verification.save();
    } catch (error) {
      throw new Error(`Identity extraction failed: ${error.message}`);
    }
  }

  async executeAddressVerification(verification, step) {
    try {
      const profile = await KycProfile.findOne({ profileId: verification.profileId });
      const addressDocs = await Document.find({ 
        profileId: verification.profileId, 
        type: 'proof_of_address'
      });

      const results = [];
      for (const doc of addressDocs) {
        if (doc.extractedData && doc.extractedData.fields) {
          const comparison = this.compareAddressData(profile.address, doc.extractedData.fields);
          results.push({
            documentId: doc.documentId,
            comparison,
            matchScore: comparison.overallScore
          });
        }
      }

      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'completed';
      verification.steps[stepIndex].completedAt = new Date();
      verification.steps[stepIndex].data = { addressResults: results };

      await verification.save();
    } catch (error) {
      throw new Error(`Address verification failed: ${error.message}`);
    }
  }

  async executeComplianceCheck(verification, step) {
    try {
      const profile = await KycProfile.findOne({ profileId: verification.profileId });
      const checkTypes = ['sanctions_check', 'pep_check', 'adverse_media'];
      
      const results = [];
      for (const checkType of checkTypes) {
        try {
          let result;
          switch (checkType) {
            case 'sanctions_check':
              result = await complianceService.checkSanctions(profile.personalInfo);
              break;
            case 'pep_check':
              result = await complianceService.checkPEP(profile.personalInfo);
              break;
            case 'adverse_media':
              result = await complianceService.checkAdverseMedia(profile.personalInfo);
              break;
          }
          results.push({ type: checkType, ...result });
        } catch (error) {
          results.push({ 
            type: checkType, 
            status: 'error', 
            error: error.message 
          });
        }
      }

      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'completed';
      verification.steps[stepIndex].completedAt = new Date();
      verification.steps[stepIndex].data = { complianceResults: results };

      await verification.save();
    } catch (error) {
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }

  async executeBiometricVerification(verification, step) {
    try {
      const selfieDocs = await Document.find({ 
        profileId: verification.profileId, 
        type: 'selfie'
      });

      const identityDocs = await Document.find({ 
        profileId: verification.profileId, 
        type: 'identity_front'
      });

      // Simplified biometric check - in production, use face recognition services
      const biometricResults = {
        faceMatch: selfieDocs.length > 0 && identityDocs.length > 0,
        livenessCheck: selfieDocs.length > 0,
        confidenceScore: 85 // Mock score
      };

      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'completed';
      verification.steps[stepIndex].completedAt = new Date();
      verification.steps[stepIndex].data = { biometricResults };

      await verification.save();
    } catch (error) {
      throw new Error(`Biometric verification failed: ${error.message}`);
    }
  }

  async queueForManualReview(verification, step) {
    try {
      const stepIndex = verification.steps.findIndex(s => s.stepId === step.stepId);
      verification.steps[stepIndex].status = 'pending';
      verification.steps[stepIndex].data = { queuedForReview: true, queuedAt: new Date() };
      
      verification.status = 'pending';
      await verification.save();

      logger.info(`Verification ${verification.verificationId} queued for manual review`);
    } catch (error) {
      throw new Error(`Queue for manual review failed: ${error.message}`);
    }
  }

  async finalizeVerification(verificationId) {
    try {
      const verification = await Verification.findById(verificationId);
      if (!verification) {
        throw new Error('Verification not found');
      }

      // Calculate overall results
      const results = this.calculateOverallResults(verification);
      verification.results = results;

      // Determine final status
      if (results.overallScore >= 80) {
        verification.status = 'completed';
        verification.completedAt = new Date();
      } else if (results.overallScore >= 60) {
        // Queue for manual review
        verification.steps.push({
          stepId: 'manual_review',
          name: 'Manual Review',
          status: 'pending',
          data: { reason: 'Low confidence score requires manual review' }
        });
        verification.status = 'pending';
      } else {
        verification.status = 'failed';
        verification.completedAt = new Date();
      }

      verification.timeline.push({
        event: 'verification_finalized',
        timestamp: new Date(),
        details: `Verification ${verification.status} with score ${results.overallScore}`,
        performedBy: 'system'
      });

      await verification.save();

      // Update KYC profile if verification completed successfully
      if (verification.status === 'completed') {
        await this.updateKycProfileFromVerification(verification);
      }

      logger.info(`Verification finalized: ${verification.verificationId}, status: ${verification.status}`);
      return verification;
    } catch (error) {
      logger.error('Finalize verification error:', error);
      throw error;
    }
  }

  async completeVerification(verificationId, completionData) {
    try {
      const verification = await Verification.findOne({ verificationId });
      if (!verification) {
        throw new Error('Verification not found');
      }

      verification.status = 'completed';
      verification.completedAt = new Date();
      verification.results = completionData.results || verification.results;
      verification.reviewNotes = completionData.reviewNotes;

      verification.timeline.push({
        event: 'verification_completed',
        timestamp: new Date(),
        details: 'Verification manually completed',
        performedBy: 'admin'
      });

      await verification.save();

      // Update KYC profile
      await this.updateKycProfileFromVerification(verification);

      return verification;
    } catch (error) {
      logger.error('Complete verification error:', error);
      throw error;
    }
  }

  async failVerification(verificationId, failureData) {
    try {
      const verification = await Verification.findOne({ verificationId });
      if (!verification) {
        throw new Error('Verification not found');
      }

      verification.status = 'failed';
      verification.completedAt = new Date();
      verification.reviewNotes = failureData.reviewNotes;

      verification.timeline.push({
        event: 'verification_failed',
        timestamp: new Date(),
        details: failureData.reason || 'Verification failed',
        performedBy: 'admin'
      });

      await verification.save();
      return verification;
    } catch (error) {
      logger.error('Fail verification error:', error);
      throw error;
    }
  }

  async manualReview(verificationId, reviewData) {
    try {
      const verification = await Verification.findOne({ verificationId });
      if (!verification) {
        throw new Error('Verification not found');
      }

      verification.reviewedBy = reviewData.reviewedBy;
      verification.reviewedAt = new Date();
      verification.reviewNotes = reviewData.notes;

      if (reviewData.overrideResults) {
        verification.results = { ...verification.results, ...reviewData.overrideResults };
      }

      switch (reviewData.decision) {
        case 'approve':
          verification.status = 'completed';
          verification.completedAt = new Date();
          await this.updateKycProfileFromVerification(verification);
          break;
        case 'reject':
          verification.status = 'failed';
          verification.completedAt = new Date();
          break;
        case 'request_more_info':
          verification.status = 'pending';
          // Could trigger notification to user for more documents
          break;
      }

      verification.timeline.push({
        event: 'manual_review_completed',
        timestamp: new Date(),
        details: `Manual review: ${reviewData.decision}`,
        performedBy: reviewData.reviewedBy
      });

      await verification.save();
      return verification;
    } catch (error) {
      logger.error('Manual review error:', error);
      throw error;
    }
  }

  async retryVerification(verificationId, resetSteps = false) {
    try {
      const verification = await Verification.findOne({ verificationId });
      if (!verification) {
        throw new Error('Verification not found');
      }

      if (resetSteps) {
        // Reset all steps to pending
        verification.steps.forEach(step => {
          step.status = 'pending';
          step.completedAt = null;
          step.errors = [];
        });
      }

      verification.status = 'pending';
      verification.completedAt = null;

      verification.timeline.push({
        event: 'verification_retried',
        timestamp: new Date(),
        details: resetSteps ? 'Verification retried with reset steps' : 'Verification retried',
        performedBy: 'system'
      });

      await verification.save();

      // Start processing again
      await this.processNextStep(verification._id);

      return verification;
    } catch (error) {
      logger.error('Retry verification error:', error);
      throw error;
    }
  }

  getVerificationSteps(verificationType) {
    const stepTemplates = {
      identity: [
        { stepId: 'document_verification', name: 'Document Verification', status: 'pending' },
        { stepId: 'identity_extraction', name: 'Identity Data Extraction', status: 'pending' },
        { stepId: 'biometric_verification', name: 'Biometric Verification', status: 'pending' }
      ],
      address: [
        { stepId: 'document_verification', name: 'Document Verification', status: 'pending' },
        { stepId: 'address_verification', name: 'Address Verification', status: 'pending' }
      ],
      comprehensive: [
        { stepId: 'document_verification', name: 'Document Verification', status: 'pending' },
        { stepId: 'identity_extraction', name: 'Identity Data Extraction', status: 'pending' },
        { stepId: 'address_verification', name: 'Address Verification', status: 'pending' },
        { stepId: 'biometric_verification', name: 'Biometric Verification', status: 'pending' },
        { stepId: 'compliance_check', name: 'Compliance Check', status: 'pending' }
      ]
    };

    return stepTemplates[verificationType] || stepTemplates.comprehensive;
  }

  calculateOverallResults(verification) {
    const results = {
      overallScore: 0,
      riskScore: 50, // Default medium risk
      checks: [],
      flags: []
    };

    let totalScore = 0;
    let scoreCount = 0;

    // Process each completed step
    verification.steps.forEach(step => {
      if (step.status === 'completed' && step.data) {
        switch (step.stepId) {
          case 'document_verification':
            if (step.data.documentResults) {
              const avgDocScore = step.data.documentResults.reduce((sum, result) => 
                sum + (result.overallScore || 0), 0) / step.data.documentResults.length;
              totalScore += avgDocScore;
              scoreCount++;
            }
            break;
          case 'identity_extraction':
            if (step.data.matchScore) {
              totalScore += step.data.matchScore;
              scoreCount++;
            }
            break;
          case 'address_verification':
            if (step.data.addressResults && step.data.addressResults.length > 0) {
              const avgAddressScore = step.data.addressResults.reduce((sum, result) => 
                sum + (result.matchScore || 0), 0) / step.data.addressResults.length;
              totalScore += avgAddressScore;
              scoreCount++;
            }
            break;
          case 'biometric_verification':
            if (step.data.biometricResults && step.data.biometricResults.confidenceScore) {
              totalScore += step.data.biometricResults.confidenceScore;
              scoreCount++;
            }
            break;
          case 'compliance_check':
            if (step.data.complianceResults) {
              const flaggedResults = step.data.complianceResults.filter(r => r.status === 'flagged');
              if (flaggedResults.length > 0) {
                results.riskScore = Math.min(100, results.riskScore + (flaggedResults.length * 20));
                results.flags.push(...flaggedResults.map(r => ({
                  type: r.type,
                  severity: 'high',
                  description: `Flagged in ${r.type}`,
                  recommendation: 'Manual review required'
                })));
              }
            }
            break;
        }
      }
    });

    results.overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    return results;
  }

  compareIdentityData(profileData, extractedData) {
    const comparison = {
      matches: {},
      overallScore: 0
    };

    const fields = ['firstName', 'lastName', 'dateOfBirth'];
    let matchCount = 0;

    fields.forEach(field => {
      const profileValue = profileData[field]?.toString().toLowerCase();
      const extractedValue = extractedData[field]?.toString().toLowerCase();
      
      if (profileValue && extractedValue) {
        const match = profileValue === extractedValue;
        comparison.matches[field] = match;
        if (match) matchCount++;
      }
    });

    comparison.overallScore = Math.round((matchCount / fields.length) * 100);
    return comparison;
  }

  compareAddressData(profileAddress, extractedAddress) {
    const comparison = {
      matches: {},
      overallScore: 0
    };

    const fields = ['street', 'city', 'postalCode', 'country'];
    let matchCount = 0;

    fields.forEach(field => {
      const profileValue = profileAddress[field]?.toString().toLowerCase();
      const extractedValue = extractedAddress[field]?.toString().toLowerCase();
      
      if (profileValue && extractedValue) {
        const match = profileValue.includes(extractedValue) || extractedValue.includes(profileValue);
        comparison.matches[field] = match;
        if (match) matchCount++;
      }
    });

    comparison.overallScore = Math.round((matchCount / fields.length) * 100);
    return comparison;
  }

  async updateKycProfileFromVerification(verification) {
    try {
      const profile = await KycProfile.findOne({ profileId: verification.profileId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      if (verification.status === 'completed') {
        profile.verificationStatus = 'approved';
        profile.approvedAt = new Date();
        
        // Update verification level based on verification type
        if (verification.type === 'comprehensive') {
          profile.verificationLevel = 'advanced';
        } else if (verification.type === 'identity') {
          profile.verificationLevel = 'intermediate';
        }

        // Update risk level based on verification results
        if (verification.results.riskScore <= 30) {
          profile.riskLevel = 'low';
        } else if (verification.results.riskScore <= 70) {
          profile.riskLevel = 'medium';
        } else {
          profile.riskLevel = 'high';
        }

        profile.verificationHistory.push({
          status: 'approved',
          reviewedAt: new Date(),
          notes: `Approved via ${verification.type} verification (Score: ${verification.results.overallScore})`
        });
      }

      await profile.save();
      logger.info(`KYC profile updated from verification: ${profile.profileId}`);
    } catch (error) {
      logger.error('Update KYC profile from verification error:', error);
      // Don't throw error as verification is already completed
    }
  }
}

module.exports = new VerificationService();
