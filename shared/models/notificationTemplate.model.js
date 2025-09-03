const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    unique: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    required: [true, 'Template type is required'],
    enum: [
      'email', 'sms', 'push', 'in_app', 'webhook'
    ],
    index: true
  },
  subject: {
    type: String,
    required: [true, 'Template subject is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Template content is required']
  },
  variables: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'draft'
  },
  category: {
    type: String,
    enum: [
      'authentication', 'transaction', 'kyc', 'generation', 'payment',
      'security', 'system', 'marketing', 'support'
    ],
    default: 'system'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko']
  },
  isHtml: {
    type: Boolean,
    default: false
  },
  attachments: {
    type: [{
      name: String,
      url: String,
      type: String
    }],
    default: []
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Last modified by is required']
  },
  version: {
    type: Number,
    default: 1
  },
  tags: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
notificationTemplateSchema.index({ type: 1, status: 1 });
notificationTemplateSchema.index({ category: 1 });
notificationTemplateSchema.index({ language: 1 });
notificationTemplateSchema.index({ tags: 1 });

// Method to render template with variables
notificationTemplateSchema.methods.render = function(variables = {}) {
  let renderedSubject = this.subject;
  let renderedContent = this.content;

  // Replace variables in subject and content
  this.variables.forEach(variable => {
    const placeholder = `{{${variable}}}`;
    const value = variables[variable] || '';
    
    renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), value);
    renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), value);
  });

  return {
    subject: renderedSubject,
    content: renderedContent
  };
};

// Method to validate variables
notificationTemplateSchema.methods.validateVariables = function(variables = {}) {
  const missingVariables = [];
  const extraVariables = [];

  // Check for missing required variables
  this.variables.forEach(variable => {
    if (!(variable in variables)) {
      missingVariables.push(variable);
    }
  });

  // Check for extra variables not defined in template
  Object.keys(variables).forEach(variable => {
    if (!this.variables.includes(variable)) {
      extraVariables.push(variable);
    }
  });

  return {
    isValid: missingVariables.length === 0,
    missingVariables,
    extraVariables
  };
};

// Create model from schema
const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

module.exports = NotificationTemplate;
