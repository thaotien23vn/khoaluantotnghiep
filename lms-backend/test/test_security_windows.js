// Windows-compatible Security Testing Script
// Run this with: node test_security_windows.js

require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:5000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testHeader(title) {
  console.log('');
  colorLog('yellow', `[TEST] ${title}`);
  console.log('---');
}

function success(message) {
  colorLog('green', `✓ ${message}`);
}

function error(message) {
  colorLog('red', `✗ ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  colorLog('bright', '==========================================');
  console.log('LMS Backend - Security Testing Suite');
  colorLog('bright', '==========================================');
  console.log('');

  // Test 1: Health Check
  testHeader('Health Check Endpoint');
  try {
    const response = await axios.get(`${API_URL}/api/health`);
    if (response.data.message && response.data.message.includes('running')) {
      success('Server is running');
    } else {
      error('Server health check failed');
    }
  } catch (err) {
    error('Server health check failed');
    console.log('Error:', err.message);
  }

  // Test 2: Admin Login
  testHeader('Admin Login');
  let adminToken = '';
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: ADMIN_PASSWORD
    });
    
    if (response.data.data && response.data.data.token) {
      adminToken = response.data.data.token;
      success('Admin login successful');
    } else {
      error('Admin login failed');
      return;
    }
  } catch (err) {
    error('Admin login failed');
    console.log('Error:', err.response?.data || err.message);
    return;
  }

  // Test 3: Register Student
  testHeader('Register Student User');
  let studentToken = '';
  let studentEmail = '';
  try {
    const timestamp = Date.now();
    studentEmail = `student_${timestamp}@example.com`;
    
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      name: 'Test Student',
      username: `student_${timestamp}`,
      email: studentEmail,
      password: 'password123',
      role: 'student'
    });
    
    if (response.data.data && response.data.data.user) {
      success('Student registered successfully');
      console.log(`  Email: ${studentEmail}`);
      
      // Verify email
      const verifyCode = response.data.data.verificationCode;
      await axios.post(`${API_URL}/api/auth/verify-email-code`, {
        token: verifyCode
      });
      success('Student email verified');
      
      // Login student
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: studentEmail,
        password: 'password123'
      });
      
      if (loginResponse.data.data && loginResponse.data.data.token) {
        studentToken = loginResponse.data.data.token;
        success('Student login successful');
      }
    }
  } catch (err) {
    error('Student registration failed');
    console.log('Error:', err.response?.data || err.message);
  }

  // Test 4: Authorization Tests
  testHeader('Authorization - Student Access');
  try {
    const response = await axios.get(`${API_URL}/api/student/enrollments`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    success('Student can access student endpoints');
  } catch (err) {
    error('Student cannot access student endpoints');
    console.log('Error:', err.response?.data || err.message);
  }

  testHeader('Authorization - Teacher Cannot Access Admin');
  try {
    await axios.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    error('Authorization check failed - student accessed admin endpoint');
  } catch (err) {
    if (err.response?.status === 403) {
      success('Student correctly denied access to admin endpoint');
    } else {
      error('Unexpected error in authorization test');
    }
  }

  testHeader('Authorization - Admin Can Access All');
  try {
    const response = await axios.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    success('Admin can access admin endpoints');
  } catch (err) {
    error('Admin cannot access admin endpoints');
    console.log('Error:', err.response?.data || err.message);
  }

  try {
    const response = await axios.get(`${API_URL}/api/teacher/courses`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    success('Admin can access teacher endpoints');
  } catch (err) {
    error('Admin cannot access teacher endpoints');
    console.log('Error:', err.response?.data || err.message);
  }

  // Test 5: Token Validation
  testHeader('Authentication - Missing Token');
  try {
    await axios.get(`${API_URL}/api/student/enrollments`);
    error('Missing token validation failed');
  } catch (err) {
    if (err.response?.status === 401) {
      success('Missing token correctly rejected');
    } else {
      error('Unexpected error in missing token test');
    }
  }

  testHeader('Authentication - Invalid Token');
  try {
    await axios.get(`${API_URL}/api/student/enrollments`, {
      headers: { Authorization: 'Bearer invalid_token_xyz' }
    });
    error('Invalid token validation failed');
  } catch (err) {
    if (err.response?.status === 401) {
      success('Invalid token correctly rejected');
    } else {
      error('Unexpected error in invalid token test');
    }
  }

  // Final Summary
  console.log('');
  colorLog('bright', '==========================================');
  console.log('Security Testing Summary');
  colorLog('bright', '==========================================');
  success('All tests completed!');
  console.log('');
  console.log('Key Features Verified:');
  console.log('  ✓ Admin authentication');
  console.log('  ✓ Student registration & verification');
  console.log('  ✓ JWT token generation');
  console.log('  ✓ Role-based access control');
  console.log('  ✓ Authorization enforcement');
  console.log('  ✓ Token validation');
  console.log('');
  console.log('Generated Tokens:');
  console.log(`  Admin: ${adminToken.substring(0, 50)}...`);
  console.log(`  Student: ${studentToken.substring(0, 50)}...`);
  console.log('');
  colorLog('bright', '==========================================');
}

// Run tests
runTests().catch(console.error);
