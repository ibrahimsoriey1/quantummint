# Database Schema for Digital Money Generation System

## Overview

The database schema is designed using MongoDB, a NoSQL database that provides flexibility and scalability for our digital money generation system. The schema includes collections for users, wallets, transactions, payment providers, and system configurations.

## Collections

### 1. Users Collection

```json
{
  "_id": "ObjectId",
  "username": "String",
  "email": "String",
  "passwordHash": "String",
  "salt": "String",
  "firstName": "String",
  "lastName": "String",
  "phoneNumber": "String",
  "countryCode": "String",
  "dateOfBirth": "Date",
  "address": {
    "street": "String",
    "city": "String",
    "state": "String",
    "postalCode": "String",
    "country": "String"
  },
  "idVerification": {
    "idType": "String",
    "idNumber": "String",
    "idExpiryDate": "Date",
    "verificationStatus": "String",
    "verificationDate": "Date",
    "verifiedBy": "String"
  },
  "role": "String",
  "status": "String",
  "twoFactorEnabled": "Boolean",
  "twoFactorSecret": "String",
  "lastLogin": "Date",
  "failedLoginAttempts": "Number",
  "accountLocked": "Boolean",
  "accountLockedUntil": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 2. Wallets Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "balance": "Number",
  "currency": "String",
  "walletType": "String",
  "status": "String",
  "dailyGenerationLimit": "Number",
  "monthlyGenerationLimit": "Number",
  "totalGenerated": "Number",
  "dailyGenerated": "Number",
  "monthlyGenerated": "Number",
  "lastGenerationDate": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 3. Transactions Collection

```json
{
  "_id": "ObjectId",
  "transactionType": "String",
  "sourceWalletId": "ObjectId",
  "destinationWalletId": "ObjectId",
  "amount": "Number",
  "currency": "String",
  "fee": "Number",
  "status": "String",
  "description": "String",
  "reference": "String",
  "metadata": "Object",
  "ipAddress": "String",
  "deviceInfo": "String",
  "location": {
    "latitude": "Number",
    "longitude": "Number",
    "country": "String",
    "city": "String"
  },
  "createdAt": "Date",
  "updatedAt": "Date",
  "completedAt": "Date"
}
```

### 4. Generation Records Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "walletId": "ObjectId",
  "amount": "Number",
  "currency": "String",
  "generationMethod": "String",
  "generationParams": "Object",
  "status": "String",
  "verificationStatus": "String",
  "verifiedBy": "String",
  "verifiedAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 5. Cash Out Requests Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "walletId": "ObjectId",
  "amount": "Number",
  "currency": "String",
  "provider": "String",
  "providerAccountId": "String",
  "providerAccountName": "String",
  "providerTransactionId": "String",
  "fee": "Number",
  "status": "String",
  "failureReason": "String",
  "retryCount": "Number",
  "lastRetryAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date",
  "completedAt": "Date"
}
```

### 6. Payment Providers Collection

```json
{
  "_id": "ObjectId",
  "name": "String",
  "type": "String",
  "apiEndpoint": "String",
  "apiVersion": "String",
  "authType": "String",
  "credentials": {
    "clientId": "String",
    "clientSecret": "String",
    "apiKey": "String",
    "merchantId": "String"
  },
  "webhookUrl": "String",
  "webhookSecret": "String",
  "status": "String",
  "supportedCurrencies": ["String"],
  "transactionLimits": {
    "minAmount": "Number",
    "maxAmount": "Number",
    "dailyLimit": "Number",
    "monthlyLimit": "Number"
  },
  "fees": {
    "fixedFee": "Number",
    "percentageFee": "Number",
    "minFee": "Number",
    "maxFee": "Number"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 7. Audit Logs Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "action": "String",
  "resourceType": "String",
  "resourceId": "ObjectId",
  "previousState": "Object",
  "newState": "Object",
  "ipAddress": "String",
  "userAgent": "String",
  "timestamp": "Date"
}
```

### 8. System Configuration Collection

```json
{
  "_id": "ObjectId",
  "key": "String",
  "value": "Mixed",
  "description": "String",
  "category": "String",
  "isEncrypted": "Boolean",
  "lastModifiedBy": "ObjectId",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9. KYC Verification Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "verificationType": "String",
  "documentType": "String",
  "documentNumber": "String",
  "documentExpiryDate": "Date",
  "documentFrontImage": "String",
  "documentBackImage": "String",
  "selfieImage": "String",
  "verificationStatus": "String",
  "verificationNotes": "String",
  "verifiedBy": "ObjectId",
  "rejectionReason": "String",
  "createdAt": "Date",
  "updatedAt": "Date",
  "verifiedAt": "Date"
}
```

### 10. Notification Templates Collection

```json
{
  "_id": "ObjectId",
  "name": "String",
  "type": "String",
  "subject": "String",
  "content": "String",
  "variables": ["String"],
  "status": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 11. Notifications Collection

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "templateId": "ObjectId",
  "channel": "String",
  "recipient": "String",
  "subject": "String",
  "content": "String",
  "metadata": "Object",
  "status": "String",
  "sentAt": "Date",
  "readAt": "Date",
  "createdAt": "Date"
}
```

## Indexes

### Users Collection
- `email`: Unique index
- `phoneNumber`: Unique index
- `username`: Unique index
- `status`: Index for filtering active/inactive users

### Wallets Collection
- `userId`: Index for quick lookup of user wallets
- `status`: Index for filtering active/inactive wallets

### Transactions Collection
- `sourceWalletId`: Index for quick lookup of wallet transactions
- `destinationWalletId`: Index for quick lookup of wallet transactions
- `status`: Index for filtering by transaction status
- `createdAt`: Index for time-based queries
- `transactionType`: Index for filtering by transaction type

### Generation Records Collection
- `userId`: Index for quick lookup of user generation records
- `walletId`: Index for quick lookup of wallet generation records
- `status`: Index for filtering by generation status
- `createdAt`: Index for time-based queries

### Cash Out Requests Collection
- `userId`: Index for quick lookup of user cash out requests
- `walletId`: Index for quick lookup of wallet cash out requests
- `status`: Index for filtering by cash out status
- `createdAt`: Index for time-based queries
- `provider`: Index for filtering by payment provider

### Audit Logs Collection
- `userId`: Index for quick lookup of user activities
- `action`: Index for filtering by action type
- `resourceType`: Index for filtering by resource type
- `timestamp`: Index for time-based queries

## Relationships

1. **User to Wallets**: One-to-Many (One user can have multiple wallets)
2. **Wallet to Transactions**: One-to-Many (One wallet can have multiple transactions)
3. **User to Generation Records**: One-to-Many (One user can have multiple generation records)
4. **Wallet to Generation Records**: One-to-Many (One wallet can have multiple generation records)
5. **User to Cash Out Requests**: One-to-Many (One user can have multiple cash out requests)
6. **Wallet to Cash Out Requests**: One-to-Many (One wallet can have multiple cash out requests)
7. **User to KYC Verification**: One-to-Many (One user can have multiple verification records)
8. **User to Notifications**: One-to-Many (One user can receive multiple notifications)

## Data Validation Rules

1. **Users**:
   - Email must be valid format
   - Password must meet complexity requirements
   - Phone number must be valid format with country code

2. **Wallets**:
   - Balance cannot be negative
   - Currency must be from supported list
   - Generation limits must be positive numbers

3. **Transactions**:
   - Amount must be positive
   - Fee must be non-negative
   - Status must be from predefined list

4. **Generation Records**:
   - Amount must be positive
   - Status must be from predefined list

5. **Cash Out Requests**:
   - Amount must be positive
   - Provider must be from supported list
   - Status must be from predefined list

## Data Encryption

The following fields should be encrypted at rest:
- User.passwordHash
- User.salt
- User.idVerification.idNumber
- PaymentProvider.credentials
- KYCVerification.documentNumber

## Data Retention Policies

1. **Transaction Data**: Retained for 7 years for compliance and audit purposes
2. **User Data**: Retained as long as the account is active, then anonymized after account closure
3. **Audit Logs**: Retained for 5 years
4. **KYC Documents**: Retained for the duration required by local regulations (typically 5-7 years)