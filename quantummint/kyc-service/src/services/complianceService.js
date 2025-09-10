const axios = require('axios');
const logger = require('../utils/logger');

class ComplianceService {
  constructor() {
    // In production, these would be real compliance API endpoints
    this.sanctionsApiUrl = process.env.SANCTIONS_API_URL || 'https://api.sanctions-check.com';
    this.pepApiUrl = process.env.PEP_API_URL || 'https://api.pep-check.com';
    this.adverseMediaApiUrl = process.env.ADVERSE_MEDIA_API_URL || 'https://api.adverse-media.com';
    this.watchlistApiUrl = process.env.WATCHLIST_API_URL || 'https://api.watchlist-check.com';
  }

  async checkSanctions(personalInfo) {
    try {
      // Simulate sanctions check - in production, use real sanctions databases
      const searchQuery = `${personalInfo.firstName} ${personalInfo.lastName}`;
      
      // Mock API call
      const mockResult = await this.simulateComplianceCheck('sanctions', searchQuery);
      
      return {
        status: mockResult.found ? 'flagged' : 'clear',
        details: mockResult.found ? 'Match found in sanctions database' : 'No sanctions matches found',
        score: mockResult.found ? 100 : 0,
        matches: mockResult.matches || [],
        checkedAt: new Date(),
        provider: 'internal'
      };
    } catch (error) {
      logger.error('Sanctions check error:', error);
      return {
        status: 'error',
        details: error.message,
        score: 0,
        checkedAt: new Date()
      };
    }
  }

  async checkPEP(personalInfo) {
    try {
      // Simulate PEP (Politically Exposed Person) check
      const searchQuery = `${personalInfo.firstName} ${personalInfo.lastName}`;
      
      const mockResult = await this.simulateComplianceCheck('pep', searchQuery);
      
      return {
        status: mockResult.found ? 'flagged' : 'clear',
        details: mockResult.found ? 'Match found in PEP database' : 'No PEP matches found',
        score: mockResult.found ? 85 : 0,
        matches: mockResult.matches || [],
        checkedAt: new Date(),
        provider: 'internal'
      };
    } catch (error) {
      logger.error('PEP check error:', error);
      return {
        status: 'error',
        details: error.message,
        score: 0,
        checkedAt: new Date()
      };
    }
  }

  async checkAdverseMedia(personalInfo) {
    try {
      // Simulate adverse media check
      const searchQuery = `${personalInfo.firstName} ${personalInfo.lastName}`;
      
      const mockResult = await this.simulateComplianceCheck('adverse_media', searchQuery);
      
      return {
        status: mockResult.found ? 'flagged' : 'clear',
        details: mockResult.found ? 'Adverse media mentions found' : 'No adverse media found',
        score: mockResult.found ? 70 : 0,
        matches: mockResult.matches || [],
        checkedAt: new Date(),
        provider: 'internal'
      };
    } catch (error) {
      logger.error('Adverse media check error:', error);
      return {
        status: 'error',
        details: error.message,
        score: 0,
        checkedAt: new Date()
      };
    }
  }

  async checkWatchlist(personalInfo) {
    try {
      // Simulate watchlist check
      const searchQuery = `${personalInfo.firstName} ${personalInfo.lastName}`;
      
      const mockResult = await this.simulateComplianceCheck('watchlist', searchQuery);
      
      return {
        status: mockResult.found ? 'flagged' : 'clear',
        details: mockResult.found ? 'Match found in watchlist' : 'No watchlist matches found',
        score: mockResult.found ? 90 : 0,
        matches: mockResult.matches || [],
        checkedAt: new Date(),
        provider: 'internal'
      };
    } catch (error) {
      logger.error('Watchlist check error:', error);
      return {
        status: 'error',
        details: error.message,
        score: 0,
        checkedAt: new Date()
      };
    }
  }

  async simulateComplianceCheck(checkType, searchQuery) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock high-risk names for testing
    const highRiskNames = [
      'john doe terrorist',
      'jane smith sanctions',
      'test flagged user',
      'suspicious person'
    ];

    const found = highRiskNames.some(name => 
      searchQuery.toLowerCase().includes(name.toLowerCase())
    );

    if (found) {
      return {
        found: true,
        matches: [{
          name: searchQuery,
          matchScore: 95,
          source: `${checkType}_database`,
          details: `High confidence match in ${checkType} database`,
          dateAdded: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        }]
      };
    }

    return {
      found: false,
      matches: []
    };
  }

  async performComprehensiveCheck(personalInfo) {
    try {
      const checks = await Promise.all([
        this.checkSanctions(personalInfo),
        this.checkPEP(personalInfo),
        this.checkAdverseMedia(personalInfo),
        this.checkWatchlist(personalInfo)
      ]);

      const [sanctions, pep, adverseMedia, watchlist] = checks;

      // Calculate overall risk score
      const riskFactors = [
        { type: 'sanctions', weight: 0.4, score: sanctions.score },
        { type: 'pep', weight: 0.3, score: pep.score },
        { type: 'adverse_media', weight: 0.2, score: adverseMedia.score },
        { type: 'watchlist', weight: 0.1, score: watchlist.score }
      ];

      const overallRiskScore = riskFactors.reduce((total, factor) => 
        total + (factor.score * factor.weight), 0
      );

      const riskLevel = this.calculateRiskLevel(overallRiskScore);

      return {
        overallRiskScore: Math.round(overallRiskScore),
        riskLevel,
        checks: {
          sanctions,
          pep,
          adverseMedia,
          watchlist
        },
        recommendation: this.getRecommendation(riskLevel, overallRiskScore),
        checkedAt: new Date()
      };
    } catch (error) {
      logger.error('Comprehensive compliance check error:', error);
      throw error;
    }
  }

  calculateRiskLevel(score) {
    if (score >= 80) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  getRecommendation(riskLevel, score) {
    switch (riskLevel) {
      case 'high':
        return 'REJECT - High risk individual, manual review required before any business relationship';
      case 'medium':
        return 'ENHANCED DUE DILIGENCE - Additional documentation and monitoring required';
      case 'low':
        return 'PROCEED - Standard onboarding process can continue';
      default:
        return 'MANUAL REVIEW - Unable to determine risk level automatically';
    }
  }

  async checkComplianceStatus(userId) {
    try {
      // This would typically check the latest compliance results for a user
      // For now, return mock data
      return {
        userId,
        lastChecked: new Date(),
        status: 'compliant',
        riskLevel: 'low',
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        flags: []
      };
    } catch (error) {
      logger.error('Check compliance status error:', error);
      throw error;
    }
  }

  async schedulePeriodicReview(userId, reviewType = 'annual') {
    try {
      const reviewSchedule = {
        userId,
        reviewType,
        scheduledDate: this.calculateNextReviewDate(reviewType),
        status: 'scheduled',
        createdAt: new Date()
      };

      // In production, this would be stored in a database
      logger.info(`Periodic review scheduled for user ${userId}: ${reviewType} on ${reviewSchedule.scheduledDate}`);
      
      return reviewSchedule;
    } catch (error) {
      logger.error('Schedule periodic review error:', error);
      throw error;
    }
  }

  calculateNextReviewDate(reviewType) {
    const now = new Date();
    switch (reviewType) {
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      case 'quarterly':
        return new Date(now.setMonth(now.getMonth() + 3));
      case 'semi_annual':
        return new Date(now.setMonth(now.getMonth() + 6));
      case 'annual':
      default:
        return new Date(now.setFullYear(now.getFullYear() + 1));
    }
  }

  async generateComplianceReport(userId, startDate, endDate) {
    try {
      // Mock compliance report generation
      const report = {
        userId,
        reportId: require('uuid').v4(),
        period: {
          startDate,
          endDate
        },
        summary: {
          totalChecks: 15,
          flaggedChecks: 2,
          clearedChecks: 13,
          riskLevel: 'low'
        },
        checks: [
          {
            type: 'sanctions',
            date: new Date(),
            status: 'clear',
            score: 0
          },
          {
            type: 'pep',
            date: new Date(),
            status: 'clear',
            score: 0
          }
        ],
        recommendations: [
          'Continue standard monitoring',
          'Schedule next review in 12 months'
        ],
        generatedAt: new Date(),
        generatedBy: 'system'
      };

      logger.info(`Compliance report generated for user ${userId}`);
      return report;
    } catch (error) {
      logger.error('Generate compliance report error:', error);
      throw error;
    }
  }

  async validateComplianceConfiguration() {
    try {
      const config = {
        sanctionsApi: {
          configured: !!process.env.SANCTIONS_API_URL,
          status: 'active'
        },
        pepApi: {
          configured: !!process.env.PEP_API_URL,
          status: 'active'
        },
        adverseMediaApi: {
          configured: !!process.env.ADVERSE_MEDIA_API_URL,
          status: 'active'
        },
        watchlistApi: {
          configured: !!process.env.WATCHLIST_API_URL,
          status: 'active'
        }
      };

      const allConfigured = Object.values(config).every(api => api.configured);
      
      return {
        valid: allConfigured,
        configuration: config,
        recommendations: allConfigured ? [] : [
          'Configure missing compliance API endpoints',
          'Test API connectivity',
          'Verify API credentials'
        ]
      };
    } catch (error) {
      logger.error('Validate compliance configuration error:', error);
      throw error;
    }
  }
}

module.exports = new ComplianceService();
