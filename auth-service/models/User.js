const mongoose = require('mongoose');
const userSchema = require('../../shared/models/User');

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
