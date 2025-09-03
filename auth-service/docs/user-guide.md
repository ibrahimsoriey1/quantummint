# QuantumMint Authentication Service User Guide

This guide provides detailed information on how to use the authentication features of the QuantumMint platform.

## Table of Contents

1. [Introduction](#introduction)
2. [Registration](#registration)
3. [Email Verification](#email-verification)
4. [Login](#login)
5. [Two-Factor Authentication](#two-factor-authentication)
6. [Password Management](#password-management)
7. [User Profile](#user-profile)
8. [Security Best Practices](#security-best-practices)

## Introduction

The QuantumMint Authentication Service handles all aspects of user authentication, including registration, login, two-factor authentication, and password management. This service ensures that your account remains secure while using the QuantumMint platform.

## Registration

### How to Register

1. Navigate to the registration page.
2. Fill in the required information:
   - First Name
   - Last Name
   - Email Address
   - Password (must be at least 8 characters and include uppercase, lowercase, numbers, and special characters)
   - Phone Number (optional)
   - Date of Birth
3. Click the "Register" button.
4. Check your email for a verification link.

### Registration API

```
POST /api/auth/register
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "Password123!",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account."
}
```

## Email Verification

After registering, you'll receive an email with a verification link. Click on this link to verify your email address. You must verify your email before you can log in.

### Email Verification API

```
GET /api/auth/verify-email/{token}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in."
}
```

## Login

### How to Login

1. Navigate to the login page.
2. Enter your email address and password.
3. Click the "Login" button.
4. If two-factor authentication is enabled, you'll be prompted to enter a verification code.

### Login API

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "Password123!"
}
```

**Response (without 2FA):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+1234567890",
    "role": "user",
    "twoFactorEnabled": false
  }
}
```

**Response (with 2FA enabled):**
```json
{
  "success": true,
  "twoFactorRequired": true,
  "message": "Two-factor authentication required"
}
```

## Two-Factor Authentication

Two-factor authentication (2FA) adds an extra layer of security to your account by requiring a verification code in addition to your password when logging in.

### Setting Up Two-Factor Authentication

1. Log in to your account.
2. Navigate to your profile settings.
3. Select "Security" or "Two-Factor Authentication."
4. Click "Enable Two-Factor Authentication."
5. Scan the QR code with an authenticator app (like Google Authenticator or Authy).
6. Enter the verification code from your authenticator app.
7. Save your backup codes in a secure location.

### Two-Factor Authentication APIs

#### Setup 2FA

```
POST /api/2fa/setup
```

**Response:**
```json
{
  "success": true,
  "secretKey": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,..."
}
```

#### Enable 2FA

```
POST /api/2fa/enable
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

#### Verify 2FA During Login

```
POST /api/2fa/verify
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+1234567890",
    "role": "user",
    "twoFactorEnabled": true
  }
}
```

### Using Backup Codes

If you lose access to your authenticator app, you can use backup codes to log in:

1. On the login page, after entering your email and password, click "Use Backup Code."
2. Enter one of your backup codes.
3. After using a backup code, it becomes invalid. Generate new backup codes if needed.

## Password Management

### Forgot Password

If you forget your password, you can reset it:

1. Click "Forgot Password" on the login page.
2. Enter your email address.
3. Check your email for a password reset link.
4. Click the link and enter a new password.

### Forgot Password APIs

#### Request Password Reset

```
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset instructions sent to your email"
}
```

#### Reset Password

```
POST /api/auth/reset-password/{token}
```

**Request Body:**
```json
{
  "password": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password."
}
```

### Change Password

To change your password when logged in:

1. Navigate to your profile settings.
2. Select "Security" or "Change Password."
3. Enter your current password and your new password.
4. Click "Change Password."

### Change Password API

```
PUT /api/users/change-password
```

**Request Body:**
```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## User Profile

### Viewing Your Profile

1. Log in to your account.
2. Navigate to your profile settings.
3. View and edit your profile information.

### User Profile APIs

#### Get Profile

```
GET /api/users/profile
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phoneNumber": "+1234567890",
    "role": "user",
    "twoFactorEnabled": true
  }
}
```

#### Update Profile

```
PUT /api/users/profile
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1987654321",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.doe@example.com",
    "phoneNumber": "+1987654321",
    "role": "user",
    "twoFactorEnabled": true
  }
}
```

## Security Best Practices

To keep your QuantumMint account secure, follow these best practices:

1. **Use a Strong Password**: Create a unique, complex password that includes uppercase and lowercase letters, numbers, and special characters.

2. **Enable Two-Factor Authentication**: Add an extra layer of security to your account by enabling 2FA.

3. **Keep Backup Codes Safe**: Store your 2FA backup codes in a secure location.

4. **Don't Share Your Credentials**: Never share your password or verification codes with anyone.

5. **Use a Secure Device**: Access your account from trusted devices and networks.

6. **Log Out When Finished**: Always log out when you're done using the platform, especially on shared or public devices.

7. **Update Your Information**: Keep your email address and phone number up to date to ensure you can recover your account if needed.

8. **Check for Suspicious Activity**: Regularly review your account activity and report any suspicious behavior.

9. **Keep Your Software Updated**: Ensure your browser and operating system are up to date with the latest security patches.

10. **Be Wary of Phishing**: Be cautious of emails or messages asking for your QuantumMint credentials. Official communications will never ask for your password.

For any security concerns or to report suspicious activity, please contact our support team immediately.