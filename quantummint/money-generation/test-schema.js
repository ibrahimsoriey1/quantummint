const mongoose = require('mongoose');

console.log('Testing mongoose schema methods...');

const testSchema = new mongoose.Schema({ name: String });
console.log('Schema created:', typeof testSchema);
console.log('Schema methods before assignment:', testSchema.methods);

testSchema.methods.sayHello = function () {
  return `Hello, ${this.name}`;
};

console.log('Method exists:', typeof testSchema.methods.sayHello === 'function');
console.log('Schema methods after assignment:', testSchema.methods);

const TestModel = mongoose.model('TestModel', testSchema);
console.log('Model created successfully');
