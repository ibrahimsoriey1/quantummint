# API Endpoints for Digital Money Generation System

## Base URL
```
https://api.digitalmoneysystem.com/v1
```

## Authentication Endpoints

### Register User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Description**: Register a new user in the system
- **Request Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "firstName": "string",
    "lastName": "string",
    "phoneNumber": "string",
    "countryCode": "string",
    "dateOfBirth": "string (YYYY-MM-DD)"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "userId": "string",
      "username": "string",
      "email": "string",
      "verificationRequired": true
    }
  }
  ```

### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Description**: Authenticate a user and get access token
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number",
      "user": {
        "userId": "string",
        "username": "string",
        "email": "string",
        "role": "string",
        "twoFactorEnabled": "boolean"
      }
    }
  }
  ```

### Verify Two-Factor Authentication
- **URL**: `/auth/verify-2fa`
- **Method**: `POST`
- **Description**: Verify two-factor authentication code
- **Request Body**:
  ```json
  {
    "userId": "string",
    "code": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Two-factor authentication successful",
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number"
    }
  }
  ```

### Refresh Token
- **URL**: `/auth/refresh-token`
- **Method**: `POST`
- **Description**: Get a new access token using refresh token
- **Request Body**:
  ```json
  {
    "refreshToken": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Token refreshed successfully",
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": "number"
    }
  }
  ```

### Logout
- **URL**: `/auth/logout`
- **Method**: `POST`
- **Description**: Invalidate the current session
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### Reset Password Request
- **URL**: `/auth/reset-password-request`
- **Method**: `POST`
- **Description**: Request a password reset
- **Request Body**:
  ```json
  {
    "email": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password reset instructions sent to your email"
  }
  ```

### Reset Password
- **URL**: `/auth/reset-password`
- **Method**: `POST`
- **Description**: Reset password using token
- **Request Body**:
  ```json
  {
    "token": "string",
    "newPassword": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
  }
  ```

## User Management Endpoints

### Get User Profile
- **URL**: `/users/profile`
- **Method**: `GET`
- **Description**: Get current user's profile
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "userId": "string",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phoneNumber": "string",
      "countryCode": "string",
      "dateOfBirth": "string",
      "address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postalCode": "string",
        "country": "string"
      },
      "kycStatus": "string",
      "twoFactorEnabled": "boolean",
      "createdAt": "string",
      "lastLogin": "string"
    }
  }
  ```

### Update User Profile
- **URL**: `/users/profile`
- **Method**: `PUT`
- **Description**: Update current user's profile
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "firstName": "string",
    "lastName": "string",
    "phoneNumber": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "postalCode": "string",
      "country": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "userId": "string",
      "firstName": "string",
      "lastName": "string",
      "phoneNumber": "string",
      "address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postalCode": "string",
        "country": "string"
      }
    }
  }
  ```

### Change Password
- **URL**: `/users/change-password`
- **Method**: `POST`
- **Description**: Change user's password
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

### Enable Two-Factor Authentication
- **URL**: `/users/enable-2fa`
- **Method**: `POST`
- **Description**: Enable two-factor authentication
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Two-factor authentication setup initiated",
    "data": {
      "secret": "string",
      "qrCodeUrl": "string"
    }
  }
  ```

### Verify Two-Factor Authentication Setup
- **URL**: `/users/verify-2fa-setup`
- **Method**: `POST`
- **Description**: Verify and complete two-factor authentication setup
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "code": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Two-factor authentication enabled successfully",
    "data": {
      "recoveryCodes": ["string"]
    }
  }
  ```

### Disable Two-Factor Authentication
- **URL**: `/users/disable-2fa`
- **Method**: `POST`
- **Description**: Disable two-factor authentication
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Two-factor authentication disabled successfully"
  }
  ```

## KYC Verification Endpoints

### Submit KYC Information
- **URL**: `/kyc/submit`
- **Method**: `POST`
- **Description**: Submit KYC information for verification
- **Headers**: `Authorization: Bearer {token}`
- **Request Body** (multipart/form-data):
  ```
  idType: "string" (passport, national_id, drivers_license)
  idNumber: "string"
  idExpiryDate: "string" (YYYY-MM-DD)
  documentFront: file
  documentBack: file
  selfie: file
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "KYC information submitted successfully",
    "data": {
      "verificationId": "string",
      "status": "pending"
    }
  }
  ```

### Get KYC Status
- **URL**: `/kyc/status`
- **Method**: `GET`
- **Description**: Get current KYC verification status
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "verificationId": "string",
      "status": "string",
      "submittedAt": "string",
      "verifiedAt": "string",
      "rejectionReason": "string"
    }
  }
  ```

## Wallet Endpoints

### Get User Wallets
- **URL**: `/wallets`
- **Method**: `GET`
- **Description**: Get all wallets for the current user
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "wallets": [
        {
          "walletId": "string",
          "balance": "number",
          "currency": "string",
          "walletType": "string",
          "status": "string",
          "createdAt": "string"
        }
      ]
    }
  }
  ```

### Get Wallet Details
- **URL**: `/wallets/{walletId}`
- **Method**: `GET`
- **Description**: Get details of a specific wallet
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "walletId": "string",
      "balance": "number",
      "currency": "string",
      "walletType": "string",
      "status": "string",
      "dailyGenerationLimit": "number",
      "monthlyGenerationLimit": "number",
      "totalGenerated": "number",
      "dailyGenerated": "number",
      "monthlyGenerated": "number",
      "lastGenerationDate": "string",
      "createdAt": "string"
    }
  }
  ```

## Money Generation Endpoints

### Generate Money
- **URL**: `/generate`
- **Method**: `POST`
- **Description**: Generate digital money in the user's wallet
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "walletId": "string",
    "amount": "number",
    "generationMethod": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Money generation initiated",
    "data": {
      "generationId": "string",
      "walletId": "string",
      "amount": "number",
      "status": "string",
      "createdAt": "string"
    }
  }
  ```

### Get Generation Status
- **URL**: `/generate/{generationId}`
- **Method**: `GET`
- **Description**: Get status of a specific generation request
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "generationId": "string",
      "walletId": "string",
      "amount": "number",
      "generationMethod": "string",
      "status": "string",
      "verificationStatus": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "completedAt": "string"
    }
  }
  ```

### Get Generation History
- **URL**: `/generate/history`
- **Method**: `GET`
- **Description**: Get history of money generation requests
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `status`: Filter by status (optional)
  - `startDate`: Filter by start date (optional)
  - `endDate`: Filter by end date (optional)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "generations": [
        {
          "generationId": "string",
          "walletId": "string",
          "amount": "number",
          "generationMethod": "string",
          "status": "string",
          "createdAt": "string",
          "completedAt": "string"
        }
      ],
      "pagination": {
        "totalItems": "number",
        "totalPages": "number",
        "currentPage": "number",
        "itemsPerPage": "number"
      }
    }
  }
  ```

## Transaction Endpoints

### Get Transaction History
- **URL**: `/transactions`
- **Method**: `GET`
- **Description**: Get transaction history for the user
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `walletId`: Filter by wallet ID (optional)
  - `type`: Filter by transaction type (optional)
  - `status`: Filter by status (optional)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `startDate`: Filter by start date (optional)
  - `endDate`: Filter by end date (optional)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactions": [
        {
          "transactionId": "string",
          "transactionType": "string",
          "amount": "number",
          "currency": "string",
          "fee": "number",
          "status": "string",
          "description": "string",
          "createdAt": "string",
          "completedAt": "string"
        }
      ],
      "pagination": {
        "totalItems": "number",
        "totalPages": "number",
        "currentPage": "number",
        "itemsPerPage": "number"
      }
    }
  }
  ```

### Get Transaction Details
- **URL**: `/transactions/{transactionId}`
- **Method**: `GET`
- **Description**: Get details of a specific transaction
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactionId": "string",
      "transactionType": "string",
      "sourceWalletId": "string",
      "destinationWalletId": "string",
      "amount": "number",
      "currency": "string",
      "fee": "number",
      "status": "string",
      "description": "string",
      "reference": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "completedAt": "string"
    }
  }
  ```

## Cash Out Endpoints

### Get Payment Providers
- **URL**: `/cashout/providers`
- **Method**: `GET`
- **Description**: Get available payment providers for cash out
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "providers": [
        {
          "providerId": "string",
          "name": "string",
          "type": "string",
          "supportedCurrencies": ["string"],
          "transactionLimits": {
            "minAmount": "number",
            "maxAmount": "number",
            "dailyLimit": "number",
            "monthlyLimit": "number"
          },
          "fees": {
            "fixedFee": "number",
            "percentageFee": "number",
            "minFee": "number",
            "maxFee": "number"
          }
        }
      ]
    }
  }
  ```

### Initiate Cash Out
- **URL**: `/cashout/initiate`
- **Method**: `POST`
- **Description**: Initiate a cash out request to a payment provider
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "walletId": "string",
    "amount": "number",
    "provider": "string",
    "providerAccountId": "string",
    "providerAccountName": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Cash out request initiated",
    "data": {
      "cashOutId": "string",
      "walletId": "string",
      "amount": "number",
      "fee": "number",
      "totalAmount": "number",
      "provider": "string",
      "status": "string",
      "createdAt": "string"
    }
  }
  ```

### Get Cash Out Status
- **URL**: `/cashout/{cashOutId}`
- **Method**: `GET`
- **Description**: Get status of a specific cash out request
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "cashOutId": "string",
      "walletId": "string",
      "amount": "number",
      "fee": "number",
      "totalAmount": "number",
      "provider": "string",
      "providerAccountId": "string",
      "providerAccountName": "string",
      "providerTransactionId": "string",
      "status": "string",
      "createdAt": "string",
      "updatedAt": "string",
      "completedAt": "string"
    }
  }
  ```

### Get Cash Out History
- **URL**: `/cashout/history`
- **Method**: `GET`
- **Description**: Get history of cash out requests
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `walletId`: Filter by wallet ID (optional)
  - `provider`: Filter by provider (optional)
  - `status`: Filter by status (optional)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `startDate`: Filter by start date (optional)
  - `endDate`: Filter by end date (optional)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "cashOuts": [
        {
          "cashOutId": "string",
          "walletId": "string",
          "amount": "number",
          "fee": "number",
          "provider": "string",
          "status": "string",
          "createdAt": "string",
          "completedAt": "string"
        }
      ],
      "pagination": {
        "totalItems": "number",
        "totalPages": "number",
        "currentPage": "number",
        "itemsPerPage": "number"
      }
    }
  }
  ```

## Notification Endpoints

### Get Notifications
- **URL**: `/notifications`
- **Method**: `GET`
- **Description**: Get user notifications
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `read`: Filter by read status (optional, true/false)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "notifications": [
        {
          "notificationId": "string",
          "subject": "string",
          "content": "string",
          "read": "boolean",
          "createdAt": "string",
          "readAt": "string"
        }
      ],
      "pagination": {
        "totalItems": "number",
        "totalPages": "number",
        "currentPage": "number",
        "itemsPerPage": "number"
      }
    }
  }
  ```

### Mark Notification as Read
- **URL**: `/notifications/{notificationId}/read`
- **Method**: `PUT`
- **Description**: Mark a notification as read
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Notification marked as read"
  }
  ```

### Mark All Notifications as Read
- **URL**: `/notifications/read-all`
- **Method**: `PUT`
- **Description**: Mark all notifications as read
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "message": "All notifications marked as read"
  }
  ```

## Admin Endpoints

### Get All Users (Admin Only)
- **URL**: `/admin/users`
- **Method**: `GET`
- **Description**: Get all users in the system
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `status`: Filter by status (optional)
  - `search`: Search by username, email, or name (optional)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "users": [
        {
          "userId": "string",
          "username": "string",
          "email": "string",
          "firstName": "string",
          "lastName": "string",
          "status": "string",
          "role": "string",
          "kycStatus": "string",
          "createdAt": "string",
          "lastLogin": "string"
        }
      ],
      "pagination": {
        "totalItems": "number",
        "totalPages": "number",
        "currentPage": "number",
        "itemsPerPage": "number"
      }
    }
  }
  ```

### Get User Details (Admin Only)
- **URL**: `/admin/users/{userId}`
- **Method**: `GET`
- **Description**: Get detailed information about a specific user
- **Headers**: `Authorization: Bearer {token}`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "userId": "string",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phoneNumber": "string",
      "countryCode": "string",
      "dateOfBirth": "string",
      "address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postalCode": "string",
        "country": "string"
      },
      "status": "string",
      "role": "string",
      "kycStatus": "string",
      "twoFactorEnabled": "boolean",
      "createdAt": "string",
      "lastLogin": "string",
      "wallets": [
        {
          "walletId": "string",
          "balance": "number",
          "currency": "string",
          "walletType": "string",
          "status": "string"
        }
      ]
    }
  }
  ```

### Update User Status (Admin Only)
- **URL**: `/admin/users/{userId}/status`
- **Method**: `PUT`
- **Description**: Update a user's status
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "status": "string",
    "reason": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User status updated successfully"
  }
  ```

### Review KYC Submission (Admin Only)
- **URL**: `/admin/kyc/{verificationId}/review`
- **Method**: `PUT`
- **Description**: Review and update KYC verification status
- **Headers**: `Authorization: Bearer {token}`
- **Request Body**:
  ```json
  {
    "status": "string",
    "notes": "string",
    "rejectionReason": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "KYC verification status updated successfully"
  }
  ```

### Get System Statistics (Admin Only)
- **URL**: `/admin/statistics`
- **Method**: `GET`
- **Description**: Get system-wide statistics
- **Headers**: `Authorization: Bearer {token}`
- **Query Parameters**:
  - `period`: Time period (daily, weekly, monthly, yearly)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "userStats": {
        "totalUsers": "number",
        "activeUsers": "number",
        "newUsers": "number",
        "kycVerifiedUsers": "number"
      },
      "transactionStats": {
        "totalTransactions": "number",
        "totalVolume": "number",
        "averageTransactionValue": "number"
      },
      "generationStats": {
        "totalGenerated": "number",
        "totalGenerationRequests": "number",
        "successfulGenerations": "number",
        "failedGenerations": "number"
      },
      "cashOutStats": {
        "totalCashOuts": "number",
        "totalCashOutVolume": "number",
        "successfulCashOuts": "number",
        "failedCashOuts": "number",
        "providerBreakdown": [
          {
            "provider": "string",
            "count": "number",
            "volume": "number"
          }
        ]
      }
    }
  }
  ```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "error description"
    }
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded",
    "retryAfter": "number"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```