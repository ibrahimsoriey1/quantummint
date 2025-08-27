# QuantumMint - API Documentation

## Overview

This document provides comprehensive documentation for the QuantumMint API (formerly Digital Money Generation System). The API allows developers to integrate with our platform to access authentication, money generation, transaction processing, and payment integration functionalities.

## Base URLs

| Environment | URL                                    |
|-------------|----------------------------------------|
| Production  | `https://api.quantummint.com/v1`      |
| Staging     | `https://staging-api.quantummint.com/v1` |
| Development | `https://dev-api.quantummint.com/v1`  |

## Authentication

### Authentication Methods

The API supports the following authentication methods:

1. **API Key Authentication**: For server-to-server integrations
2. **OAuth 2.0**: For user-based authentication
3. **JWT Tokens**: For session management

### API Key Authentication

For server-to-server integrations, use API key authentication:

```
Authorization: ApiKey YOUR_API_KEY
```

### OAuth 2.0 Authentication

For user-based authentication, use the OAuth 2.0 flow:

1. Redirect users to: `https://api.quantummint.com/v1/oauth/authorize`
2. Receive authorization code
3. Exchange code for access token at: `https://api.quantummint.com/v1/oauth/token`
4. Use access token in API requests:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## API Endpoints

### User Management

#### Create User

```
POST /users
```

Creates a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Response:**

```json
{
  "userId": "usr_123456789",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2025-08-20T14:30:00Z"
}
```

#### Get User

```
GET /users/{userId}
```

Retrieves user information.

**Response:**

```json
{
  "userId": "usr_123456789",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "createdAt": "2025-08-20T14:30:00Z",
  "updatedAt": "2025-08-20T14:30:00Z"
}
```

### Wallet Management

#### Create Wallet

```
POST /wallets
```

Creates a new wallet for the authenticated user.

**Request Body:**

```json
{
  "name": "Primary Wallet",
  "currency": "USD"
}
```

**Response:**

```json
{
  "walletId": "wlt_123456789",
  "name": "Primary Wallet",
  "currency": "USD",
  "balance": 0,
  "createdAt": "2025-08-20T14:35:00Z"
}
```

#### Get Wallet

```
GET /wallets/{walletId}
```

Retrieves wallet information.

**Response:**

```json
{
  "walletId": "wlt_123456789",
  "name": "Primary Wallet",
  "currency": "USD",
  "balance": 5280.00,
  "createdAt": "2025-08-20T14:35:00Z",
  "updatedAt": "2025-08-21T09:22:15Z"
}
```

#### List Wallets

```
GET /wallets
```

Lists all wallets for the authenticated user.

**Response:**

```json
{
  "wallets": [
    {
      "walletId": "wlt_123456789",
      "name": "Primary Wallet",
      "currency": "USD",
      "balance": 5280.00
    },
    {
      "walletId": "wlt_987654321",
      "name": "Savings Wallet",
      "currency": "USD",
      "balance": 10500.00
    }
  ],
  "totalCount": 2
}
```

### Money Generation

#### Generate Money

```
POST /generation
```

Generates digital money into the specified wallet.

**Request Body:**

```json
{
  "walletId": "wlt_123456789",
  "amount": 500.00,
  "algorithm": "standard"
}
```

**Response:**

```json
{
  "generationId": "gen_123456789",
  "walletId": "wlt_123456789",
  "amount": 500.00,
  "status": "completed",
  "timestamp": "2025-08-21T10:15:30Z"
}
```

#### Get Generation Status

```
GET /generation/{generationId}
```

Retrieves the status of a money generation request.

**Response:**

```json
{
  "generationId": "gen_123456789",
  "walletId": "wlt_123456789",
  "amount": 500.00,
  "status": "completed",
  "createdAt": "2025-08-21T10:15:30Z",
  "completedAt": "2025-08-21T10:15:35Z"
}
```

### Transactions

#### Transfer Funds

```
POST /transactions/transfer
```

Transfers funds between wallets.

**Request Body:**

```json
{
  "sourceWalletId": "wlt_123456789",
  "destinationWalletId": "wlt_987654321",
  "amount": 200.00,
  "description": "Savings transfer"
}
```

**Response:**

```json
{
  "transactionId": "txn_123456789",
  "sourceWalletId": "wlt_123456789",
  "destinationWalletId": "wlt_987654321",
  "amount": 200.00,
  "description": "Savings transfer",
  "status": "completed",
  "timestamp": "2025-08-21T11:30:45Z"
}
```

#### Cash Out

```
POST /transactions/cash-out
```

Initiates a cash out to an external payment provider.

**Request Body:**

```json
{
  "walletId": "wlt_123456789",
  "amount": 300.00,
  "provider": "orange_money",
  "destinationAccount": "+1234567890",
  "description": "Weekly withdrawal",
  "useCurrencyOfCountry": true
}
```

**Response:**

```json
{
  "transactionId": "txn_987654321",
  "walletId": "wlt_123456789",
  "amount": 300.00,
  "currency": "SLL",
  "originalCurrency": "USD",
  "exchangeRate": 13.5,
  "provider": "orange_money",
  "destinationAccount": "+1234567890",
  "status": "pending",
  "timestamp": "2025-08-21T12:45:20Z"
}
```

#### Get Transaction

```
GET /transactions/{transactionId}
```

Retrieves transaction details.

**Response:**

```json
{
  "transactionId": "txn_123456789",
  "type": "transfer",
  "sourceWalletId": "wlt_123456789",
  "destinationWalletId": "wlt_987654321",
  "amount": 200.00,
  "description": "Savings transfer",
  "status": "completed",
  "createdAt": "2025-08-21T11:30:45Z",
  "completedAt": "2025-08-21T11:30:50Z"
}
```

#### List Transactions

```
GET /transactions
```

Lists transactions for the authenticated user.

**Query Parameters:**

- `walletId` (optional): Filter by wallet ID
- `type` (optional): Filter by transaction type (transfer, cash-out, generation)
- `status` (optional): Filter by status (pending, completed, failed)
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date
- `limit` (optional): Number of results per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**

```json
{
  "transactions": [
    {
      "transactionId": "txn_123456789",
      "type": "transfer",
      "amount": 200.00,
      "description": "Savings transfer",
      "status": "completed",
      "timestamp": "2025-08-21T11:30:45Z"
    },
    {
      "transactionId": "txn_987654321",
      "type": "cash-out",
      "amount": 300.00,
      "provider": "orange_money",
      "status": "pending",
      "timestamp": "2025-08-21T12:45:20Z"
    }
  ],
  "totalCount": 2
}
```

### Payment Provider Integration

#### Get Payment Providers

```
GET /payment-providers
```

Lists available payment providers for cash out.

**Response:**

```json
{
  "providers": [
    {
      "id": "orange_money",
      "name": "Orange Money",
      "logo": "https://api.quantummint.com/assets/providers/orange-money.png",
      "supportedCountries": ["SL", "GH", "NG"],
      "minimumAmount": 10.00,
      "maximumAmount": 1000.00,
      "processingTime": "instant"
    },
    {
      "id": "afrimoney",
      "name": "AfriMoney",
      "logo": "https://api.quantummint.com/assets/providers/afrimoney.png",
      "supportedCountries": ["SL", "GH", "KE"],
      "minimumAmount": 5.00,
      "maximumAmount": 2000.00,
      "processingTime": "1-2 hours"
    }
  ]
}
```

## Webhooks

QuantumMint can send webhook notifications for various events. Configure your webhook endpoints in the developer dashboard.

### Webhook Events

- `user.created`: Triggered when a new user is created
- `wallet.created`: Triggered when a new wallet is created
- `generation.completed`: Triggered when money generation is completed
- `transaction.status_changed`: Triggered when a transaction status changes
- `cash_out.completed`: Triggered when a cash out is completed
- `cash_out.failed`: Triggered when a cash out fails

### Webhook Payload Example

```json
{
  "event": "cash_out.completed",
  "timestamp": "2025-08-21T14:22:30Z",
  "data": {
    "transactionId": "txn_987654321",
    "walletId": "wlt_123456789",
    "amount": 300.00,
    "provider": "orange_money",
    "destinationAccount": "+1234567890",
    "status": "completed",
    "completedAt": "2025-08-21T14:22:25Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "Insufficient funds in wallet",
    "details": {
      "walletId": "wlt_123456789",
      "availableBalance": 100.00,
      "requestedAmount": 300.00
    }
  }
}
```

### Common Error Codes

- `authentication_error`: Authentication failed
- `authorization_error`: User not authorized for this action
- `invalid_request`: Invalid request parameters
- `resource_not_found`: Requested resource not found
- `insufficient_funds`: Insufficient funds in wallet
- `rate_limit_exceeded`: API rate limit exceeded
- `internal_error`: Internal server error

## Rate Limiting

API requests are rate-limited to ensure system stability. Rate limits are applied per API key and per user.

- Standard tier: 100 requests per minute
- Premium tier: 500 requests per minute
- Enterprise tier: Custom limits

Rate limit headers are included in API responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1629557890
```

## Versioning

The QuantumMint API uses versioning to ensure backward compatibility. The current version is v1.

When a new version is released, the previous version will be supported for at least 6 months before deprecation.

## Support

For API support, contact:

- Email: api-support@quantummint.com
- Developer Portal: https://developers.quantummint.com
- API Status: https://status.quantummint.com