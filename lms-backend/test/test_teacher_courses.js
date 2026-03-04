// Test script to verify teacher courses API issue
// Run this with: node test_teacher_courses.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testTeacherCourses() {
  console.log('=== Testing Teacher Courses API ===\n');

  // Test 1: Login with first teacher and get token
  console.log('1. Testing with first teacher credentials...');
  try {
    const login1 = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'teacher1@example.com', // Replace with actual teacher email
      password: 'password123'        // Replace with actual password
    });
    
    const token1 = login1.data.data.token;
    console.log('Teacher 1 logged in successfully');
    console.log('User ID:', login1.data.data.user.id);
    console.log('User Role:', login1.data.data.user.role);
    
    // Get courses for teacher 1
    const courses1 = await axios.get(`${BASE_URL}/teacher/courses`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    
    console.log(`Teacher 1 courses count: ${courses1.data.data.courses.length}`);
    courses1.data.data.courses.forEach(course => {
      console.log(`  - Course: ${course.title} (ID: ${course.id}, CreatedBy: ${course.createdBy})`);
    });
    
  } catch (error) {
    console.log('Teacher 1 login failed:', error.response?.data?.message || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Login with second teacher and get token
  console.log('2. Testing with second teacher credentials...');
  try {
    const login2 = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'teacher2@example.com', // Replace with actual teacher email
      password: 'password123'        // Replace with actual password
    });
    
    const token2 = login2.data.data.token;
    console.log('Teacher 2 logged in successfully');
    console.log('User ID:', login2.data.data.user.id);
    console.log('User Role:', login2.data.data.user.role);
    
    // Get courses for teacher 2
    const courses2 = await axios.get(`${BASE_URL}/teacher/courses`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    console.log(`Teacher 2 courses count: ${courses2.data.data.courses.length}`);
    courses2.data.data.courses.forEach(course => {
      console.log(`  - Course: ${course.title} (ID: ${course.id}, CreatedBy: ${course.createdBy})`);
    });
    
  } catch (error) {
    console.log('Teacher 2 login failed:', error.response?.data?.message || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Test with old token (simulating the issue)
  console.log('3. Testing with old token (if available)...');
  console.log('If you have an old token, replace OLD_TOKEN_HERE and run this test');
  console.log('Check the server console logs to see the debug information');
}

// Instructions
console.log('Instructions:');
console.log('1. Update the email and password in the test script with actual teacher accounts');
console.log('2. Run: node test_teacher_courses.js');
console.log('3. Check the server console for DEBUG logs');
console.log('4. Compare the user IDs in the logs with what you expect');
console.log('\nIf you see old user ID in the logs, you are using an old token!\n');

testTeacherCourses().catch(console.error);
