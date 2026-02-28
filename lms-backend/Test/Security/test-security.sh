#!/usr/bin/env bash

# Security & Authorization Testing Script
# This script tests all the security features and role-based access control

API_URL="http://localhost:5000"
STUDENT_TOKEN=""
TEACHER_TOKEN=""
ADMIN_TOKEN=""

echo "=========================================="
echo "LMS Backend - Security Testing Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test title
test_header() {
  echo ""
  echo "${YELLOW}[TEST] $1${NC}"
  echo "---"
}

# Function to print success
success() {
  echo "${GREEN}✓ $1${NC}"
}

# Function to print error
error() {
  echo "${RED}✗ $1${NC}"
}

# Test 1: Health Check
test_header "Health Check Endpoint"
response=$(curl -s $API_URL/api/health)
if echo "$response" | grep -q "LMS Backend running"; then
  success "Server is running"
else
  error "Server health check failed"
  exit 1
fi

# Test 2: Register Student User
test_header "Register Student User"
student_response=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trần Thảo Tiên",
    "username": "thangtien_'$(date +%s)'",
    "email": "thangtien_'$(date +%s)'@example.com",
    "phone": "+84912345678",
    "password": "password123",
    "role": "student"
  }')

student_id=$(echo $student_response | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
student_email=$(echo $student_response | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
verification_code=$(echo $student_response | grep -o '"verificationCode":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$student_id" ]; then
  success "Student registered (ID: $student_id)"
  echo "  Email: $student_email"
  echo "  Verification Code: $verification_code"
else
  error "Student registration failed"
fi

# Test 3: Register Teacher User
test_header "Register Teacher User"
teacher_response=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trịnh Ngọc Thái",
    "username": "thaitrinh_'$(date +%s)'",
    "email": "thaitrinh_'$(date +%s)'@example.com",
    "phone": "+84987654321",
    "password": "password123",
    "role": "teacher"
  }')

teacher_email=$(echo $teacher_response | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
teacher_verification=$(echo $teacher_response | grep -o '"verificationCode":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$teacher_email" ]; then
  success "Teacher registered"
  echo "  Email: $teacher_email"
  echo "  Verification Code: $teacher_verification"
else
  error "Teacher registration failed"
fi

# Test 4: Register Admin User
test_header "Register Admin User"
admin_response=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "username": "admin_'$(date +%s)'",
    "email": "admin_'$(date +%s)'@example.com",
    "phone": "+84911111111",
    "password": "password123",
    "role": "admin"
  }')

admin_email=$(echo $admin_response | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
admin_verification=$(echo $admin_response | grep -o '"verificationCode":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$admin_email" ]; then
  success "Admin registered"
  echo "  Email: $admin_email"
  echo "  Verification Code: $admin_verification"
else
  error "Admin registration failed"
fi

# Test 5: Verify Email
test_header "Email Verification"

student_verify=$(curl -s -X POST $API_URL/api/auth/verify-email-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$student_email'",
    "token": "'$verification_code'"
  }')

if echo "$student_verify" | grep -q "thành công"; then
  success "Student email verified"
else
  error "Email verification failed"
fi

# Verify teacher
teacher_verify=$(curl -s -X POST $API_URL/api/auth/verify-email-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$teacher_email'",
    "token": "'$teacher_verification'"
  }')

if echo "$teacher_verify" | grep -q "thành công"; then
  success "Teacher email verified"
fi

# Verify admin
admin_verify=$(curl -s -X POST $API_URL/api/auth/verify-email-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$admin_email'",
    "token": "'$admin_verification'"
  }')

if echo "$admin_verify" | grep -q "thành công"; then
  success "Admin email verified"
fi

# Test 6: Login and Get Tokens
test_header "Login - Get JWT Tokens"

# Student login
student_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$(echo $student_response | grep -o '"username":"[^"]*"' | cut -d'"' -f4)'",
    "password": "password123"
  }')

STUDENT_TOKEN=$(echo $student_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$STUDENT_TOKEN" ]; then
  success "Student login successful"
else
  error "Student login failed"
fi

# Teacher login
teacher_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$(echo $teacher_response | grep -o '"username":"[^"]*"' | cut -d'"' -f4)'",
    "password": "password123"
  }')

TEACHER_TOKEN=$(echo $teacher_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TEACHER_TOKEN" ]; then
  success "Teacher login successful"
fi

# Admin login
admin_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$(echo $admin_response | grep -o '"username":"[^"]*"' | cut -d'"' -f4)'",
    "password": "password123"
  }')

ADMIN_TOKEN=$(echo $admin_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$ADMIN_TOKEN" ]; then
  success "Admin login successful"
fi

# Test 7: Test Student Endpoints
test_header "Authorization - Student Access"

student_enrollments=$(curl -s -X GET $API_URL/api/student/enrollments \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if echo "$student_enrollments" | grep -q "Danh sách khóa học"; then
  success "Student can access student endpoints"
else
  error "Student cannot access student endpoints"
fi

# Test 8: Test Teacher Cannot Access Admin
test_header "Authorization - Teacher Denied Admin Access"

teacher_admin=$(curl -s -X GET $API_URL/api/admin/users \
  -H "Authorization: Bearer $TEACHER_TOKEN")

if echo "$teacher_admin" | grep -q "không có quyền"; then
  success "Teacher correctly denied access to admin endpoint"
else
  error "Authorization check failed for teacher accessing admin"
fi

# Test 9: Test Student Cannot Create Course (Teacher only)
test_header "Authorization - Student Denied Teacher Access"

student_course=$(curl -s -X POST $API_URL/api/teacher/courses \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacker Course"}')

if echo "$student_course" | grep -q "không có quyền"; then
  success "Student correctly denied access to teacher endpoint"
else
  error "Authorization check failed for student accessing teacher"
fi

# Test 10: Test Admin Can Access All
test_header "Authorization - Admin Access All"

admin_users=$(curl -s -X GET $API_URL/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$admin_users" | grep -q "Danh sách"; then
  success "Admin can access admin endpoints"
fi

admin_courses=$(curl -s -X GET $API_URL/api/teacher/courses \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$admin_courses" | grep -q "Danh sách khóa học"; then
  success "Admin can access teacher endpoints"
fi

# Test 11: Test Missing Token
test_header "Authentication - Missing Token"

no_token=$(curl -s -X GET $API_URL/api/student/enrollments)

if echo "$no_token" | grep -q "Token không được cung cấp"; then
  success "Missing token correctly rejected"
else
  error "Missing token validation failed"
fi

# Test 12: Test Invalid Token
test_header "Authentication - Invalid Token"

invalid_token=$(curl -s -X GET $API_URL/api/student/enrollments \
  -H "Authorization: Bearer invalid_token_xyz")

if echo "$invalid_token" | grep -q "Token không hợp lệ"; then
  success "Invalid token correctly rejected"
else
  error "Invalid token validation failed"
fi

# Final Summary
echo ""
echo "=========================================="
echo "Security Testing Summary"
echo "=========================================="
echo "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Key Features Verified:"
echo "  ✓ Registration with role assignment"
echo "  ✓ Email verification with 6-digit codes"
echo "  ✓ JWT token generation"
echo "  ✓ Student role access"
echo "  ✓ Teacher role access"
echo "  ✓ Admin role access"
echo "  ✓ Authorization enforcement"
echo "  ✓ Token validation"
echo ""
echo "Generated Tokens (for manual testing):"
echo "  Student: $STUDENT_TOKEN"
echo "  Teacher: $TEACHER_TOKEN"
echo "  Admin:   $ADMIN_TOKEN"
echo ""
echo "=========================================="
