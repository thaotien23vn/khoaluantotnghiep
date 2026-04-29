/**
 * Jest Configuration for Experimental Tests
 * Tests using real data from production measurements
 */

module.exports = {
  // Use existing Jest setup
  ...require('./jest.config'),
  
  // Override test match pattern
  testMatch: [
    '<rootDir>/src/__tests__/experimental/**/*.test.js'
  ],
  
  // Specific test environment
  testEnvironment: 'node',
  
  // Verbose output for experimental results
  verbose: true,
  
  // Reporters
  reporters: [
    'default',
    ['<rootDir>/src/__tests__/experimental/custom-reporter.js', {}]
  ],
  
  // Coverage for experimental tests
  collectCoverage: false,
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Global variables
  globals: {
    EXPERIMENTAL_TEST_MODE: true,
  },
};
