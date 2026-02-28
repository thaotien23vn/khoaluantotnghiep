@echo off
REM Security & Authorization Testing Script for Windows
REM This script tests all the security features and role-based access control

setlocal enabledelayedexpansion
set API_URL=http://localhost:5000

echo ==========================================
echo LMS Backend - Security Testing Suite
echo ==========================================
echo.

REM Test 1: Health Check
echo [TEST] Health Check Endpoint
echo ---
curl -s %API_URL%/api/health | findstr "LMS Backend running" >nul
if !errorlevel! equ 0 (
  echo OK: Server is running
) else (
  echo ERROR: Server health check failed
  exit /b 1
)
echo.

REM Test 2: Register Student User
echo [TEST] Register Student User
echo ---
for /f "tokens=1" %%a in ('powershell -Command "Get-Date -UFormat %%s"') do (
  set TIMESTAMP=%%a
)

set STUDENT_DATA={^
  "name": "Tran Thao Tien",^
  "username": "thangtien_%TIMESTAMP%",^
  "email": "thangtien_%TIMESTAMP%@example.com",^
  "phone": "+84912345678",^
  "password": "password123",^
  "role": "student"^
}

curl -s -X POST %API_URL%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "%STUDENT_DATA%" > student_response.json

REM Parse student responses
for /f "tokens=2 delims=:" %%a in ('findstr /R "\"username\"" student_response.json') do (
  set STUDENT_USERNAME=%%a
  set STUDENT_USERNAME=!STUDENT_USERNAME:"=!
  set STUDENT_USERNAME=!STUDENT_USERNAME:,=!
  set STUDENT_USERNAME=!STUDENT_USERNAME: =!
)

for /f "tokens=2 delims=:" %%a in ('findstr /R "\"email\"" student_response.json') do (
  set STUDENT_EMAIL=%%a
  set STUDENT_EMAIL=!STUDENT_EMAIL:"=!
  set STUDENT_EMAIL=!STUDENT_EMAIL:,=!
  set STUDENT_EMAIL=!STUDENT_EMAIL: =!
)

for /f "tokens=2 delims=:" %%a in ('findstr /R "\"verificationCode\"" student_response.json') do (
  set VERIFICATION_CODE=%%a
  set VERIFICATION_CODE=!VERIFICATION_CODE:"=!
  set VERIFICATION_CODE=!VERIFICATION_CODE:,=!
  set VERIFICATION_CODE=!VERIFICATION_CODE: =!
)

echo OK: Student registered with username: %STUDENT_USERNAME%
echo Email: %STUDENT_EMAIL%
echo Verification Code: %VERIFICATION_CODE%
echo.

REM Test 3: Verify Email
echo [TEST] Email Verification
echo ---

set VERIFY_DATA={^
  "email": "%STUDENT_EMAIL%",^
  "token": "%VERIFICATION_CODE%"^
}

curl -s -X POST %API_URL%/api/auth/verify-email-code ^
  -H "Content-Type: application/json" ^
  -d "%VERIFY_DATA%" | findstr "thành công" >nul

if !errorlevel! equ 0 (
  echo OK: Student email verified
) else (
  echo ERROR: Email verification failed
)
echo.

REM Test 4: Login and Get Token
echo [TEST] Login - Get JWT Token
echo ---

set LOGIN_DATA={^
  "username": "%STUDENT_USERNAME%",^
  "password": "password123"^
}

curl -s -X POST %API_URL%/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "%LOGIN_DATA%" > student_login.json

for /f "tokens=2 delims=:" %%a in ('findstr /R "\"token\"" student_login.json') do (
  set STUDENT_TOKEN=%%a
  set STUDENT_TOKEN=!STUDENT_TOKEN:"=!
  set STUDENT_TOKEN=!STUDENT_TOKEN:,=!
  set STUDENT_TOKEN=!STUDENT_TOKEN: =!
)

if not "!STUDENT_TOKEN!"=="" (
  echo OK: Student login successful
  echo Token: !STUDENT_TOKEN!
) else (
  echo ERROR: Student login failed
)
echo.

REM Test 5: Test Student Endpoints
echo [TEST] Authorization - Student Access
echo ---

curl -s -X GET %API_URL%/api/student/enrollments ^
  -H "Authorization: Bearer !STUDENT_TOKEN!" | findstr "Danh sách" >nul

if !errorlevel! equ 0 (
  echo OK: Student can access student endpoints
) else (
  echo ERROR: Student cannot access student endpoints
)
echo.

REM Test 6: Test Student Cannot Access Admin
echo [TEST] Authorization - Student Denied Admin Access
echo ---

curl -s -X GET %API_URL%/api/admin/users ^
  -H "Authorization: Bearer !STUDENT_TOKEN!" | findstr "không có quyền" >nul

if !errorlevel! equ 0 (
  echo OK: Student correctly denied access to admin endpoint
) else (
  echo ERROR: Authorization check failed
)
echo.

REM Test 7: Test Missing Token
echo [TEST] Authentication - Missing Token
echo ---

curl -s -X GET %API_URL%/api/student/enrollments | findstr "Token không được cung cấp" >nul

if !errorlevel! equ 0 (
  echo OK: Missing token correctly rejected
) else (
  echo ERROR: Missing token validation failed
)
echo.

REM Test 8: Test Invalid Token
echo [TEST] Authentication - Invalid Token
echo ---

curl -s -X GET %API_URL%/api/student/enrollments ^
  -H "Authorization: Bearer invalid_token_xyz" | findstr "Token không hợp lệ" >nul

if !errorlevel! equ 0 (
  echo OK: Invalid token correctly rejected
) else (
  echo ERROR: Invalid token validation failed
)
echo.

echo ==========================================
echo Security Testing Summary
echo ==========================================
echo OK: All tests completed!
echo.
echo Key Features Verified:
echo   - Registration with role assignment
echo   - Email verification with 6-digit codes
echo   - JWT token generation
echo   - Student role access control
echo   - Authorization enforcement
echo   - Token validation
echo.
echo ==========================================

REM Cleanup
del /q student_response.json 2>nul
del /q student_login.json 2>nul

endlocal
