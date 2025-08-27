const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger.util');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const kycUploadsDir = path.join(uploadsDir, 'kyc');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(kycUploadsDir)) {
  fs.mkdirSync(kycUploadsDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific directory
    const userDir = path.join(kycUploadsDir, req.user.userId);
    
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir);
    }
    
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${uniqueSuffix}${fileExt}`;
    
    cb(null, fileName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * Middleware to handle KYC document uploads
 */
exports.uploadKYCDocuments = (req, res, next) => {
  const uploadFields = [
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
  ];
  
  const uploadMiddleware = upload.fields(uploadFields);
  
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error
      logger.error(`Upload error: ${err.message}`);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message
        }
      });
    } else if (err) {
      // Other error
      logger.error(`Upload error: ${err.message}`);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message
        }
      });
    }
    
    // Check required files
    if (!req.files.documentFront || !req.files.selfie) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILES',
          message: 'Document front and selfie are required'
        }
      });
    }
    
    next();
  });
};