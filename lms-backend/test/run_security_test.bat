@echo off
echo ==========================================
echo LMS Backend - Security Testing Suite
echo ==========================================
echo.

REM Set environment variables
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=admin123

echo Running security tests with admin credentials...
echo.

REM Run the security test script
bash test-security.sh

echo.
echo ==========================================
echo Security testing completed!
echo ==========================================
pause
