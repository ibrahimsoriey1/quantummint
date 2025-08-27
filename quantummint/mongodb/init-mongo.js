// Create databases and users
db = db.getSiblingDB('digital_money_auth');
db.createUser({
  user: 'auth_service',
  pwd: 'auth_password',
  roles: [{ role: 'readWrite', db: 'digital_money_auth' }]
});

db = db.getSiblingDB('digital_money_generation');
db.createUser({
  user: 'generation_service',
  pwd: 'generation_password',
  roles: [{ role: 'readWrite', db: 'digital_money_generation' }]
});

db = db.getSiblingDB('digital_money_transactions');
db.createUser({
  user: 'transaction_service',
  pwd: 'transaction_password',
  roles: [{ role: 'readWrite', db: 'digital_money_transactions' }]
});

db = db.getSiblingDB('digital_money_payments');
db.createUser({
  user: 'payment_service',
  pwd: 'payment_password',
  roles: [{ role: 'readWrite', db: 'digital_money_payments' }]
});