# QuantumMint Database Schema Implementation

This directory contains the shared database schema implementation for the QuantumMint digital money generation system. The schema is designed using MongoDB with comprehensive validation, encryption, and migration support.

## 📁 Directory Structure

```
shared/
├── config/
│   └── database.js          # Centralized database configuration
├── models/                  # Database models
│   ├── cashOutRequest.model.js
│   ├── auditLog.model.js
│   ├── systemConfig.model.js
│   ├── notificationTemplate.model.js
│   └── notification.model.js
├── migrations/              # Database migration scripts
│   ├── 001_initial_schema.js
│   └── migrate.js
├── validators/              # Data validation utilities
│   └── schemaValidator.js
├── encryption/              # Field encryption utilities
│   └── fieldEncryption.js
└── utils/
    └── logger.js            # Logging utilities
```

## 🗄️ Database Collections

### Core Collections

1. **Users** - User accounts and authentication
2. **Wallets** - Digital wallets with balance tracking
3. **Transactions** - All financial transactions
4. **Generation Records** - Money generation history
5. **Cash Out Requests** - Withdrawal requests
6. **Payment Providers** - External payment service configurations

### Supporting Collections

7. **Audit Logs** - System activity tracking
8. **System Configurations** - Application settings
9. **KYC Verifications** - Know Your Customer data
10. **Notification Templates** - Message templates
11. **Notifications** - User notifications
12. **Documents** - KYC document storage
13. **Verifications** - Verification process tracking

## 🔧 Setup and Installation

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install mongoose winston crypto
```

2. Set environment variables:
```bash
export MONGODB_URI="mongodb://localhost:27017/quantummint"
export ENCRYPTION_KEY="your-32-character-encryption-key"
export LOG_LEVEL="info"
```

3. Run database migrations:
```bash
node shared/migrations/migrate.js up
```

## 🚀 Usage

### Database Connection

```javascript
const { connectDB, checkDBHealth } = require('./shared/config/database');

// Connect to database
await connectDB();

// Check database health
const health = await checkDBHealth();
console.log(health);
```

### Using Models

```javascript
const User = require('./shared/models/user.model');
const Wallet = require('./shared/models/wallet.model');

// Create a new user
const user = new User({
  username: 'john_doe',
  email: 'john@example.com',
  passwordHash: 'hashed_password',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-01-01'),
  address: {
    country: 'US'
  }
});

await user.save();

// Create a wallet for the user
const wallet = new Wallet({
  userId: user._id,
  currency: 'USD',
  walletType: 'primary'
});

await wallet.save();
```

### Data Validation

```javascript
const schemaValidator = require('./shared/validators/schemaValidator');

// Validate user data
const userData = {
  username: 'john_doe',
  email: 'john@example.com',
  // ... other fields
};

const validation = schemaValidator.validateUser(userData);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

### Field Encryption

```javascript
const fieldEncryption = require('./shared/encryption/fieldEncryption');

// Encrypt sensitive data
const encryptedPassword = fieldEncryption.encrypt('plaintext_password');

// Decrypt data
const decryptedPassword = fieldEncryption.decrypt(encryptedPassword);

// Hash password
const { hash, salt } = fieldEncryption.hash('password');
```

## 🔄 Database Migrations

### Running Migrations

```bash
# Run all pending migrations
node shared/migrations/migrate.js up

# Check migration status
node shared/migrations/migrate.js status

# Rollback a specific migration
node shared/migrations/migrate.js down 0
```

### Creating New Migrations

1. Create a new migration file in `shared/migrations/`:
```javascript
// 002_add_new_field.js
async function up() {
  // Add new field to existing collection
  await mongoose.connection.db.collection('users').updateMany(
    {},
    { $set: { newField: 'default_value' } }
  );
}

async function down() {
  // Remove the field
  await mongoose.connection.db.collection('users').updateMany(
    {},
    { $unset: { newField: 1 } }
  );
}

module.exports = { up, down };
```

2. Add the migration to the migrations array in `migrate.js`

## 🔒 Security Features

### Data Encryption

Sensitive fields are automatically encrypted at rest:

- **Users**: `passwordHash`, `salt`, `idVerification.idNumber`, `twoFactorSecret`
- **Payment Providers**: `credentials.clientSecret`, `credentials.apiKey`, `webhookSecret`
- **KYC Verifications**: `documentNumber`

### Data Validation

Comprehensive validation rules ensure data integrity:

- Email format validation
- Phone number format validation
- Password strength requirements
- Currency code validation
- ObjectId format validation
- Enum value validation

### Audit Logging

All system activities are logged with:

- User actions
- Resource changes
- IP addresses
- Timestamps
- Location data (when available)

## 📊 Performance Optimization

### Indexes

Strategic indexes are created for optimal query performance:

- **Users**: email, username, phoneNumber, status, role
- **Wallets**: userId, status, currency, walletType
- **Transactions**: userId, sourceWalletId, destinationWalletId, status, createdAt
- **Generation Records**: userId, walletId, status, createdAt
- **Audit Logs**: userId, action, resourceType, timestamp (with TTL)

### Data Retention

- **Audit Logs**: 5 years (automatic cleanup)
- **Notifications**: 1 year (automatic cleanup)
- **Transaction Data**: 7 years (manual cleanup)
- **User Data**: Retained while account is active

## 🧪 Testing

### Unit Tests

```bash
# Run validation tests
npm test -- --grep "SchemaValidator"

# Run encryption tests
npm test -- --grep "FieldEncryption"
```

### Integration Tests

```bash
# Test database connections
npm test -- --grep "Database"

# Test migrations
npm test -- --grep "Migration"
```

## 📈 Monitoring

### Health Checks

```javascript
const { checkDBHealth } = require('./shared/config/database');

// Check database status
const health = await checkDBHealth();
console.log('Database Status:', health.status);
console.log('Connection State:', health.readyState);
```

### Logging

All database operations are logged with appropriate levels:

- **INFO**: Successful operations
- **WARN**: Non-critical issues
- **ERROR**: Critical failures

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/quantummint` |
| `ENCRYPTION_KEY` | 32-character encryption key | Generated (not recommended for production) |
| `LOG_LEVEL` | Logging level | `info` |
| `NODE_ENV` | Environment | `development` |

### Database Options

```javascript
const options = {
  maxPoolSize: 10,              // Maximum connections
  serverSelectionTimeoutMS: 5000, // Connection timeout
  socketTimeoutMS: 45000,       // Socket timeout
  bufferMaxEntries: 0,          // Disable buffering
  bufferCommands: false         // Disable command buffering
};
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check MongoDB server status
   - Verify connection string
   - Check network connectivity

2. **Migration Failures**
   - Check MongoDB permissions
   - Verify migration scripts
   - Review error logs

3. **Encryption Errors**
   - Verify encryption key is set
   - Check key length (32 characters)
   - Ensure consistent key across instances

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL="debug"
export DEBUG="mongoose:*"
```

## 📚 API Reference

### Models

- [User Model](./models/user.model.js)
- [Wallet Model](./models/wallet.model.js)
- [Transaction Model](./models/transaction.model.js)
- [Generation Model](./models/generation.model.js)
- [CashOutRequest Model](./models/cashOutRequest.model.js)
- [AuditLog Model](./models/auditLog.model.js)
- [SystemConfig Model](./models/systemConfig.model.js)
- [NotificationTemplate Model](./models/notificationTemplate.model.js)
- [Notification Model](./models/notification.model.js)

### Utilities

- [Schema Validator](./validators/schemaValidator.js)
- [Field Encryption](./encryption/fieldEncryption.js)
- [Database Config](./config/database.js)
- [Logger](./utils/logger.js)

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure migrations are reversible
5. Test with different MongoDB versions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation
- Contact the development team
