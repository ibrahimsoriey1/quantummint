const multer = require('multer');
const path = require('path');
const { ApiError } = require('./errorHandler');
require('dotenv').config();

// Configure file size limit
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024; // Convert MB to bytes

// Configure allowed file types
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');

// Configure storage
const storage = multer.memoryStorage(); // Store files in memory for S3 upload

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    return cb(new ApiError(400, `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`), false);
  }
  
  cb(null, true);
};

// Configure multer
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

// Single file upload middleware
const uploadSingleFile = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ApiError(400, `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`));
          }
          return next(new ApiError(400, err.message));
        }
        return next(err);
      }
      
      if (!req.file) {
        return next(new ApiError(400, `${fieldName} file is required`));
      }
      
      next();
    });
  };
};

// Multiple files upload middleware
const uploadMultipleFiles = (fieldName, maxCount) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ApiError(400, `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`));
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new ApiError(400, `Too many files. Maximum is ${maxCount}`));
          }
          return next(new ApiError(400, err.message));
        }
        return next(err);
      }
      
      if (!req.files || req.files.length === 0) {
        return next(new ApiError(400, `${fieldName} files are required`));
      }
      
      next();
    });
  };
};

// Fields upload middleware
const uploadFields = (fields) => {
  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ApiError(400, `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`));
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new ApiError(400, 'Unexpected file field'));
          }
          return next(new ApiError(400, err.message));
        }
        return next(err);
      }
      
      // Check if all required fields are present
      for (const field of fields) {
        if (field.required && (!req.files || !req.files[field.name] || req.files[field.name].length === 0)) {
          return next(new ApiError(400, `${field.name} file is required`));
        }
      }
      
      next();
    });
  };
};

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  uploadFields
};