#!/usr/bin/env node

// Simple test runner for the Kanban API
// Run with: node test-runner.js

const { runAllTests } = require('./tests/api.test.js');

console.log('🚀 Starting Kanban API Tests');
console.log('Make sure the development server is running on http://localhost:3000\n');

runAllTests()
  .then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  });
