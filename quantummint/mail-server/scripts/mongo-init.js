// MongoDB initialization script for QuantumMint Mail Server

// Switch to the quantummail database
db = db.getSiblingDB('quantummail');

// Create collections with proper indexes
db.createCollection('mailusers');
db.createCollection('emailmessages');
db.createCollection('analytics');

// Create indexes for MailUser collection
db.mailusers.createIndex({ "email": 1 }, { unique: true });
db.mailusers.createIndex({ "username": 1 }, { unique: true });
db.mailusers.createIndex({ "isActive": 1 });
db.mailusers.createIndex({ "lastLogin": 1 });
db.mailusers.createIndex({ "createdAt": 1 });

// Create indexes for EmailMessage collection
db.emailmessages.createIndex({ "messageId": 1 }, { unique: true });
db.emailmessages.createIndex({ "userId": 1 });
db.emailmessages.createIndex({ "date": -1 });
db.emailmessages.createIndex({ "folder": 1 });
db.emailmessages.createIndex({ "flags": 1 });
db.emailmessages.createIndex({ "from.address": 1 });
db.emailmessages.createIndex({ "to.address": 1 });
db.emailmessages.createIndex({ "subject": "text" });
db.emailmessages.createIndex({ "deliveryStatus": 1 });
db.emailmessages.createIndex({ "spamScore": 1 });
db.emailmessages.createIndex({ "virusStatus": 1 });

// Create compound indexes for common queries
db.emailmessages.createIndex({ "userId": 1, "folder": 1, "date": -1 });
db.emailmessages.createIndex({ "userId": 1, "flags": 1 });

// Create indexes for analytics collection
db.analytics.createIndex({ "timestamp": 1 });
db.analytics.createIndex({ "type": 1, "timestamp": 1 });

// Create admin user
db.mailusers.insertOne({
  email: "admin@quantummint.com",
  username: "admin",
  password: "$2a$10$rOzJqQZ8kVx.8vF5H5Zz5OqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq", // 'admin123' - change this!
  isAdmin: true,
  isActive: true,
  quota: 10737418240, // 10GB
  quotaUsed: 0,
  createdAt: new Date(),
  lastLogin: null,
  loginAttempts: 0,
  lockUntil: null,
  aliases: [],
  forwarding: {
    enabled: false,
    addresses: []
  },
  autoresponder: {
    enabled: false,
    subject: "",
    message: ""
  },
  spamSettings: {
    enabled: true,
    threshold: 5.0,
    action: "folder"
  },
  statistics: {
    emailsSent: 0,
    emailsReceived: 0,
    lastActivity: new Date()
  }
});

print("QuantumMint Mail Server database initialized successfully!");
print("Default admin user created: admin@quantummint.com / admin123");
print("IMPORTANT: Change the default admin password after first login!");
