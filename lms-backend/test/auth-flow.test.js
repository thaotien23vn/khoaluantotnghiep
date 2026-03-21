/**
 * Authentication Flow Testing Script
 * Tests complete auth flow: register, verify, login, forgot/reset password
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  name: 'Test User',
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  phone: '0123456789',
  password: 'Test123456'
};

let verificationCode = null;
let resetToken = null;
let authToken = null;

/**
 * Log test result
 */
const logResult = (testName, success, data, error = null) => {
  console.log(`\n${success ? '✅' : '❌'} ${testName}`);
  if (success) {
    console.log('Response:', JSON.stringify(data, null, 2));
  } else {
    console.log('Error:', error || data);
  }
};

/**
 * Test registration
 */
const testRegister = async () => {
  try {
    console.log('\n🧪 Testing Registration...');
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    
    if (response.data.success) {
      verificationCode = response.data.data.verificationCode;
      logResult('Registration', true, response.data);
      return true;
    } else {
      logResult('Registration', false, response.data);
      return false;
    }
  } catch (error) {
    logResult('Registration', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test email verification
 */
const testEmailVerification = async () => {
  try {
    console.log('\n🧪 Testing Email Verification...');
    const response = await axios.post(`${BASE_URL}/auth/verify-email-code`, {
      code: verificationCode
    });
    
    logResult('Email Verification', true, response.data);
    return true;
  } catch (error) {
    logResult('Email Verification', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test login
 */
const testLogin = async () => {
  try {
    console.log('\n🧪 Testing Login...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.data.success) {
      authToken = response.data.data.token;
      logResult('Login', true, response.data);
      return true;
    } else {
      logResult('Login', false, response.data);
      return false;
    }
  } catch (error) {
    logResult('Login', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test forgot password
 */
const testForgotPassword = async () => {
  try {
    console.log('\n🧪 Testing Forgot Password...');
    const response = await axios.post(`${BASE_URL}/auth/forgot-password`, {
      email: testUser.email
    });
    
    logResult('Forgot Password', true, response.data);
    return true;
  } catch (error) {
    logResult('Forgot Password', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test get current user
 */
const testGetCurrentUser = async () => {
  try {
    console.log('\n🧪 Testing Get Current User...');
    const response = await axios.get(`${BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    logResult('Get Current User', true, response.data);
    return true;
  } catch (error) {
    logResult('Get Current User', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test update current user
 */
const testUpdateCurrentUser = async () => {
  try {
    console.log('\n🧪 Testing Update Current User...');
    const response = await axios.put(`${BASE_URL}/auth/me`, {
      name: 'Updated Test User',
      phone: '0987654321'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    logResult('Update Current User', true, response.data);
    return true;
  } catch (error) {
    logResult('Update Current User', false, null, error.response?.data || error.message);
    return false;
  }
};

/**
 * Test validation errors
 */
const testValidationErrors = async () => {
  try {
    console.log('\n🧪 Testing Validation Errors...');
    
    // Test invalid registration
    const invalidUser = {
      name: '',
      username: 'a',
      email: 'invalid-email',
      password: '123'
    };
    
    const response = await axios.post(`${BASE_URL}/auth/register`, invalidUser);
    
    logResult('Validation Errors', false, response.data);
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      logResult('Validation Errors', true, error.response.data);
      return true;
    } else {
      logResult('Validation Errors', false, null, error.response?.data || error.message);
      return false;
    }
  }
};

/**
 * Test duplicate registration
 */
const testDuplicateRegistration = async () => {
  try {
    console.log('\n🧪 Testing Duplicate Registration...');
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    
    logResult('Duplicate Registration', false, response.data);
    return false;
  } catch (error) {
    if (error.response?.status === 409) {
      logResult('Duplicate Registration', true, error.response.data);
      return true;
    } else {
      logResult('Duplicate Registration', false, null, error.response?.data || error.message);
      return false;
    }
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log('🚀 Starting Authentication Flow Tests...\n');
  console.log('Test User Data:', JSON.stringify(testUser, null, 2));
  
  const results = [];
  
  // Run tests in sequence
  results.push(await testRegister());
  results.push(await testValidationErrors());
  results.push(await testDuplicateRegistration());
  results.push(await testEmailVerification());
  results.push(await testLogin());
  results.push(await testGetCurrentUser());
  results.push(await testUpdateCurrentUser());
  results.push(await testForgotPassword());
  
  // Summary
  const passedTests = results.filter(r => r).length;
  const totalTests = results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the logs above.');
  }
  
  return passedTests === totalTests;
};

// Check if server is running
const checkServer = async () => {
  try {
    await axios.get(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first.');
    console.log('Run: npm run dev');
    return false;
  }
};

// Run tests if server is available
if (require.main === module) {
  checkServer().then(isRunning => {
    if (isRunning) {
      runAllTests().then(success => {
        process.exit(success ? 0 : 1);
      });
    } else {
      process.exit(1);
    }
  });
}

module.exports = {
  runAllTests,
  testRegister,
  testEmailVerification,
  testLogin,
  testForgotPassword,
  testGetCurrentUser,
  testUpdateCurrentUser,
  testValidationErrors,
  testDuplicateRegistration
};
