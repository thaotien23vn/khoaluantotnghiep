// Test script for Quiz API
// Run this with: node test_quiz_api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testQuizAPI() {
  console.log('=== Testing Quiz API ===\n');

  try {
    // Test login first
    console.log('1. Logging in as teacher...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'a@example.com', // Replace with actual teacher email
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('Login successful! Token obtained.');
    
    // Test creating a quiz
    console.log('\n2. Testing quiz creation...');
    try {
      const quizResponse = await axios.post(`${BASE_URL}/teacher/courses/1/quizzes`, {
        title: 'Test Quiz',
        maxScore: 100,
        timeLimit: 60,
        passingScore: 60
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Quiz created successfully!');
      console.log('Quiz ID:', quizResponse.data.data.quiz.id);
      
      const quizId = quizResponse.data.data.quiz.id;
      
      // Test adding a multiple choice question
      console.log('\n3. Testing multiple choice question creation...');
      try {
        const questionResponse = await axios.post(`${BASE_URL}/teacher/quizzes/${quizId}/questions`, {
          type: 'multiple_choice',
          content: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4',
          points: 1
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Multiple choice question created successfully!');
        console.log('Question ID:', questionResponse.data.data.question.id);
        
      } catch (questionError) {
        console.log('Question creation failed:', questionError.response?.data || questionError.message);
      }
      
    } catch (quizError) {
      console.log('Quiz creation failed:', quizError.response?.data || quizError.message);
    }
    
  } catch (loginError) {
    console.log('Login failed:', loginError.response?.data || loginError.message);
  }
}

console.log('Instructions:');
console.log('1. Make sure server is running on port 5000');
console.log('2. Update email and password with actual teacher credentials');
console.log('3. Make sure you have a course with ID 1 or update the course ID');
console.log('4. Run: node test_quiz_api.js\n');

testQuizAPI().catch(console.error);
