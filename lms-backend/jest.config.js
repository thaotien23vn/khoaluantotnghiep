module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.teardown.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: false,
};
