# QuantumMint Platform API Documentation

## Overview

The QuantumMint platform provides a comprehensive RESTful API for digital money generation, transactions, payments, and KYC verification. All APIs are accessed through the API Gateway at `http://localhost:3000/api`.

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
http://localhost:3000/api
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Authentication Service

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt_token"
  }
}
```

### Login

**POST** `/auth/login`

Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt_token",
    "expiresIn": "24h"
  }
}
```

### Enable 2FA

**POST** `/auth/2fa/enable`

Enable two-factor authentication.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "base32_secret",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### Verify 2FA

**POST** `/auth/2fa/verify`

Verify 2FA token.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "token": "123456"
}
```

### Forgot Password

**POST** `/auth/forgot-password`

Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### Reset Password

**POST** `/auth/reset-password`

Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token",
  "newPassword": "newSecurePassword123"
}
```

---

## Transaction Service

### Get User Balance

**GET** `/transactions/balance`

Get current user balance.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "available": 1000.50,
    "locked": 100.00,
    "currency": "USD",
    "lastUpdated": "2023-12-01T10:00:00.000Z"
  }
}
```

### Create Transaction

**POST** `/transactions`

Create a new transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "credit",
  "amount": 100.00,
  "description": "Money generation reward",
  "metadata": {
    "generationId": "gen_123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "txn_123",
    "type": "credit",
    "amount": 100.00,
    "status": "completed",
    "description": "Money generation reward",
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Transfer Funds

**POST** `/transactions/transfer`

Transfer funds to another user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "recipientId": "user_456",
  "amount": 50.00,
  "description": "Payment for services"
}
```

### Get Transaction History

**GET** `/transactions/history`

Get user transaction history with pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `type` (optional): Filter by transaction type
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_123",
        "type": "credit",
        "amount": 100.00,
        "status": "completed",
        "description": "Money generation reward",
        "createdAt": "2023-12-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### Lock Funds

**POST** `/transactions/lock`

Lock funds for pending operations.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 100.00,
  "reason": "Pending money generation"
}
```

### Unlock Funds

**POST** `/transactions/unlock`

Unlock previously locked funds.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 100.00,
  "reason": "Generation completed"
}
```

---

## Money Generation Service

### Create Generation Request

**POST** `/money-generation/generate`

Create a new money generation request.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 1000,
  "complexity": "medium",
  "description": "Monthly generation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "gen_123",
    "amount": 1000,
    "complexity": "medium",
    "status": "pending",
    "estimatedTime": 300000,
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Get Generation Status

**GET** `/money-generation/status/:id`

Get status of a generation request.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "gen_123",
    "status": "processing",
    "progress": 45,
    "estimatedTimeRemaining": 150000,
    "startTime": "2023-12-01T10:00:00.000Z"
  }
}
```

### Get Generation History

**GET** `/money-generation/history`

Get user's generation history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "generations": [
      {
        "id": "gen_123",
        "amount": 1000,
        "status": "completed",
        "generatedAmount": 1000,
        "complexity": "medium",
        "createdAt": "2023-12-01T10:00:00.000Z",
        "completedAt": "2023-12-01T10:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

### Cancel Generation

**POST** `/money-generation/cancel/:id`

Cancel a pending generation request.

**Headers:** `Authorization: Bearer <token>`

---

## Payment Integration Service

### Create Payment

**POST** `/payments/create`

Create a new payment.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USD",
  "provider": "stripe",
  "method": "card",
  "paymentMethodId": "pm_card_visa"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_123",
    "amount": 100.00,
    "currency": "USD",
    "status": "pending",
    "provider": "stripe",
    "clientSecret": "pi_client_secret"
  }
}
```

### Get Payment Status

**GET** `/payments/status/:id`

Get payment status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_123",
    "status": "completed",
    "amount": 100.00,
    "currency": "USD",
    "provider": "stripe",
    "createdAt": "2023-12-01T10:00:00.000Z",
    "completedAt": "2023-12-01T10:01:00.000Z"
  }
}
```

### Process Refund

**POST** `/payments/refund/:id`

Process a refund for a payment.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 50.00,
  "reason": "Customer request"
}
```

### Get Payment History

**GET** `/payments/history`

Get user's payment history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `provider` (optional): Filter by provider
- `status` (optional): Filter by status

---

## KYC Service

### Create KYC Profile

**POST** `/kyc/profile`

Create a new KYC profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "nationality": "US"
  },
  "contactInfo": {
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "US"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "kyc_123",
    "status": "pending",
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Upload Document

**POST** `/kyc/documents`

Upload KYC document.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `type`: Document type (passport, driver_license, utility_bill)
- `file`: Document file (image/pdf)

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_123",
    "type": "passport",
    "status": "uploaded",
    "uploadedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Get KYC Status

**GET** `/kyc/status`

Get current KYC status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "verified",
    "riskLevel": "low",
    "verificationDate": "2023-12-01T10:00:00.000Z",
    "documents": [
      {
        "type": "passport",
        "status": "verified"
      }
    ]
  }
}
```

### Submit for Verification

**POST** `/kyc/submit`

Submit KYC profile for verification.

**Headers:** `Authorization: Bearer <token>`

---

## Rate Limits

- Authentication endpoints: 5 requests per minute
- General API endpoints: 100 requests per minute
- File upload endpoints: 10 requests per minute

## Webhooks

The platform supports webhooks for real-time notifications:

### Payment Webhooks

**POST** `/webhooks/payments`

Receives payment status updates from providers.

### Generation Webhooks

**POST** `/webhooks/generation`

Receives money generation completion notifications.

## SDK Examples

### JavaScript/Node.js

```javascript
const QuantumMintAPI = require('@quantummint/sdk');

const client = new QuantumMintAPI({
  baseURL: 'http://localhost:3000/api',
  token: 'your-jwt-token'
});

// Create money generation request
const generation = await client.moneyGeneration.create({
  amount: 1000,
  complexity: 'medium'
});

// Get balance
const balance = await client.transactions.getBalance();
```

### Python

```python
from quantummint import QuantumMintClient

client = QuantumMintClient(
    base_url='http://localhost:3000/api',
    token='your-jwt-token'
)

# Create payment
payment = client.payments.create(
    amount=100.00,
    currency='USD',
    provider='stripe'
)
```

## Support

For API support and questions:
- Email: api-support@quantummint.com
- Documentation: https://docs.quantummint.com
- Status Page: https://status.quantummint.com
