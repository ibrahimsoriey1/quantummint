import * as Yup from 'yup';

// Common validation patterns
const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export const loginSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required')
});

export const registerSchema = Yup.object({
  firstName: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .required('First name is required'),
  lastName: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .required('Last name is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
  phoneNumber: Yup.string()
    .matches(phoneRegex, 'Invalid phone number format')
    .required('Phone number is required'),
  countryCode: Yup.string()
    .required('Country code is required'),
  dateOfBirth: Yup.date()
    .max(new Date(), 'Date of birth cannot be in the future')
    .required('Date of birth is required')
});

export const forgotPasswordSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
});

export const resetPasswordSchema = Yup.object({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required')
});

export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string()
    .required('Current password is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword'), null], 'Passwords must match')
    .required('Confirm password is required')
});

export const profileUpdateSchema = Yup.object({
  firstName: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .required('First name is required'),
  lastName: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .required('Last name is required'),
  phoneNumber: Yup.string()
    .matches(phoneRegex, 'Invalid phone number format'),
  countryCode: Yup.string()
});

export const twoFactorSchema = Yup.object({
  token: Yup.string()
    .length(6, 'Token must be 6 digits')
    .matches(/^\d{6}$/, 'Token must contain only numbers')
    .required('Token is required')
});

export const contactSchema = Yup.object({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Name is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  subject: Yup.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject must be less than 200 characters')
    .required('Subject is required'),
  message: Yup.string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters')
    .required('Message is required')
});

export const moneyGenerationSchema = Yup.object({
  amount: Yup.number()
    .min(1, 'Amount must be at least 1')
    .max(10000, 'Amount cannot exceed 10,000')
    .required('Amount is required'),
  currency: Yup.string()
    .oneOf(['USD', 'EUR', 'GBP', 'BTC', 'ETH'], 'Invalid currency')
    .required('Currency is required'),
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters')
});

export const kycDocumentSchema = Yup.object({
  documentType: Yup.string()
    .oneOf(['passport', 'drivers_license', 'national_id', 'other'], 'Invalid document type')
    .required('Document type is required'),
  documentNumber: Yup.string()
    .min(5, 'Document number must be at least 5 characters')
    .max(50, 'Document number must be less than 50 characters')
    .required('Document number is required'),
  expiryDate: Yup.date()
    .min(new Date(), 'Expiry date must be in the future')
    .required('Expiry date is required')
});





