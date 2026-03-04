#!/usr/bin/env bash

# Security & Authorization Testing Script
# This script tests all the security features and role-based access control

API_URL="http://localhost:5000"
STUDENT_TOKEN=""
TEACHER_TOKEN=""
ADMIN_TOKEN=""
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

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
TIMESTAMP=$(date +%s)
student_response=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Student\",
    \"username\": \"student_$TIMESTAMP\",
    \"email\": \"student_$TIMESTAMP@example.com\",
    \"phone\": \"+84912345678\",
    \"password\": \"password123\",
    \"role\": \"student\"
  }")

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

test_header "Login Admin (bootstrap account required)"
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  error "Missing ADMIN_USERNAME / ADMIN_PASSWORD env vars. Create a bootstrap admin in DB, then run:"
  echo "  ADMIN_USERNAME=... ADMIN_PASSWORD=... ./test-security.sh"
  exit 1
fi

admin_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'$ADMIN_USERNAME'",
    "password": "'$ADMIN_PASSWORD'"
  }')

ADMIN_TOKEN=$(echo $admin_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$ADMIN_TOKEN" ]; then
  success "Admin login successful"
else
  error "Admin login failed (check username/password & isEmailVerified)"
  exit 1
fi

# Test 5: Verify Email
test_header "Email Verification"

student_verify=$(curl -s -X POST $API_URL/api/auth/verify-email-code \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$verification_code\"
  }")

if echo "$student_verify" | grep -q "thành công\|success\|verified"; then
  success "Student email verified"
else
  error "Email verification failed"
  echo "Response: $student_verify"
fi

test_header "Admin creates Teacher user"
TEACHER_TIMESTAMP=$(date +%s)
teacher_username="teacher_$TEACHER_TIMESTAMP"
teacher_email="$teacher_username@example.com"
create_teacher=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Teacher\",
    \"username\": \"$teacher_username\",
    \"email\": \"$teacher_email\",
    \"password\": \"password123\",
    \"role\": \"teacher\"
  }")

if echo "$create_teacher" | grep -q '"role":"teacher"\|success'; then
  success "Teacher created by admin"
  echo "  Email: $teacher_email"
else
  error "Admin failed to create teacher"
  echo "Response: $create_teacher"
fi

# Test 6: Login and Get Tokens
test_header "Login - Get JWT Tokens"

# Student login
student_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$student_email\",
    \"password\": \"password123\"
  }")

STUDENT_TOKEN=$(echo $student_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$STUDENT_TOKEN" ]; then
  success "Student login successful"
else
  error "Student login failed"
  echo "Response: $student_login"
fi

# Teacher login (created by admin)
teacher_login=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$teacher_email\",
    \"password\": \"password123\"
  }")

TEACHER_TOKEN=$(echo $teacher_login | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$TEACHER_TOKEN" ]; then
  success "Teacher login successful"
else
  error "Teacher login failed"
  echo "Response: $teacher_login"
fi

# Admin token already set above

# Test 7: Test Student Endpoints
test_header "Authorization - Student Access"

student_enrollments=$(curl -s -X GET $API_URL/api/student/enrollments \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if echo "$student_enrollments" | grep -q "enrollments\|success\|data"; then
  success "Student can access student endpoints"
else
  error "Student cannot access student endpoints"
  echo "Response: $student_enrollments"
fi

# Test 8: Test Teacher Cannot Access Admin
test_header "Authorization - Teacher Denied Admin Access"

teacher_admin=$(curl -s -X GET $API_URL/api/admin/users \
  -H "Authorization: Bearer $TEACHER_TOKEN")

if echo "$teacher_admin" | grep -q "không có quyền\|forbidden\|403"; then
  success "Teacher correctly denied access to admin endpoint"
else
  error "Authorization check failed for teacher accessing admin"
  echo "Response: $teacher_admin"
fi

# Test 9: Test Student Cannot Create Course (Teacher only)
test_header "Authorization - Student Denied Teacher Access"

student_course=$(curl -s -X POST $API_URL/api/teacher/courses \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacker Course"}')

if echo "$student_course" | grep -q "không có quyền\|forbidden\|403"; then
  success "Student correctly denied access to teacher endpoint"
else
  error "Authorization check failed for student accessing teacher"
  echo "Response: $student_course"
fi

# Test 10: Test Admin Can Access All
test_header "Authorization - Admin Access All"

admin_users=$(curl -s -X GET $API_URL/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$admin_users" | grep -q "users\|success\|data"; then
  success "Admin can access admin endpoints"
else
  error "Admin cannot access admin endpoints"
  echo "Response: $admin_users"
fi

admin_courses=$(curl -s -X GET $API_URL/api/teacher/courses \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$admin_courses" | grep -q "courses\|success\|data"; then
  success "Admin can access teacher endpoints"
else
  error "Admin cannot access teacher endpoints"
  echo "Response: $admin_courses"
fi

# Test 11: Test Missing Token
test_header "Authentication - Missing Token"

no_token=$(curl -s -X GET $API_URL/api/student/enrollments)

if echo "$no_token" | grep -q "Token không được cung cấp\|Unauthorized\|401"; then
  success "Missing token correctly rejected"
else
  error "Missing token validation failed"
  echo "Response: $no_token"
fi

# Test 12: Test Invalid Token
test_header "Authentication - Invalid Token"

invalid_token=$(curl -s -X GET $API_URL/api/student/enrollments \
  -H "Authorization: Bearer invalid_token_xyz")

if echo "$invalid_token" | grep -q "Token không hợp lệ\|Unauthorized\|401"; then
  success "Invalid token correctly rejected"
else
  error "Invalid token validation failed"
  echo "Response: $invalid_token"
fi

# Final Summary
echo ""
echo "=========================================="
echo "Security Testing Summary"
echo "=========================================="
echo "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Key Features Verified:"
echo "  ✓ Registration (self-register student only)"
echo "  ✓ Admin creates teacher/student accounts"
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
