/**
 * Email Service Tests
 * Tests for email.service.js with mocked fetch API
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Email Service Tests', () => {
  let emailService;
  const mockApiKey = 'test-api-key-12345';
  const mockFromEmail = 'test@example.com';
  const mockFromName = 'Test App';

  beforeEach(() => {
    jest.clearAllMocks();
    // Silence console during tests
    console.log = jest.fn();
    console.error = jest.fn();

    // Reset modules to reload with fresh config
    jest.resetModules();

    // Mock email config
    jest.doMock('../config/email', () => ({
      apiKey: mockApiKey,
      fromEmail: mockFromEmail,
      fromName: mockFromName,
    }));

    // Load email service with mocked config
    emailService = require('../services/email.service');
  });

  afterEach(() => {
    jest.dontMock('../config/email');
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('isConfigured', () => {
    test('should return true when API key is configured', () => {
      expect(emailService.isConfigured()).toBe(true);
    });

    test('should return false when API key is not configured', () => {
      jest.resetModules();
      jest.doMock('../config/email', () => ({
        apiKey: null,
        fromEmail: mockFromEmail,
        fromName: mockFromName,
      }));
      emailService = require('../services/email.service');
      expect(emailService.isConfigured()).toBe(false);
    });
  });

  describe('sendEmailViaBrevo', () => {
    test('should send email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ messageId: 'test-message-123' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailService.sendEmailViaBrevo(
        'recipient@example.com',
        'John Doe',
        'Test Subject',
        '<p>Test HTML</p>'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': mockApiKey,
          }),
        })
      );
    });

    test('should throw error when not configured', async () => {
      jest.resetModules();
      jest.doMock('../config/email', () => ({
        apiKey: null,
        fromEmail: mockFromEmail,
        fromName: mockFromName,
      }));
      emailService = require('../services/email.service');

      await expect(
        emailService.sendEmailViaBrevo('to@test.com', 'Name', 'Subject', '<p>HTML</p>')
      ).rejects.toThrow('Email service not configured');
    });

    test('should throw error on API failure', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ message: 'Invalid email' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        emailService.sendEmailViaBrevo('to@test.com', 'Name', 'Subject', '<p>HTML</p>')
      ).rejects.toThrow('Invalid email');
    });
  });

  describe('sendVerificationEmail', () => {
    test('should send verification email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ messageId: 'verify-msg-123' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailService.sendVerificationEmail(
        'user@example.com',
        'John Doe',
        '123456',
        'https://example.com/verify?token=abc'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('verify-msg-123');
    });

    test('should return skipped when not configured', async () => {
      jest.resetModules();
      jest.doMock('../config/email', () => ({
        apiKey: null,
        fromEmail: mockFromEmail,
        fromName: mockFromName,
      }));
      emailService = require('../services/email.service');

      const result = await emailService.sendVerificationEmail(
        'user@example.com',
        'John Doe',
        '123456',
        'https://example.com/verify'
      );

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
    });
  });

  describe('sendResetPasswordEmail', () => {
    test('should send reset password email successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ messageId: 'reset-msg-456' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailService.sendResetPasswordEmail(
        'user@example.com',
        'John Doe',
        'reset-token-123',
        'https://example.com/reset?token=abc'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('reset-msg-456');
    });

    test('should throw error when not configured', async () => {
      jest.resetModules();
      jest.doMock('../config/email', () => ({
        apiKey: null,
        fromEmail: mockFromEmail,
        fromName: mockFromName,
      }));
      emailService = require('../services/email.service');

      await expect(
        emailService.sendResetPasswordEmail('user@test.com', 'Name', 'token', 'https://link.com')
      ).rejects.toThrow('Email service not configured');
    });
  });

  describe('verifyEmailConnection', () => {
    test('should return true on successful connection', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ email: 'account@example.com' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await emailService.verifyEmailConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/account',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'api-key': mockApiKey,
          }),
        })
      );
    });

    test('should return false when not configured', async () => {
      jest.resetModules();
      jest.doMock('../config/email', () => ({
        apiKey: null,
        fromEmail: mockFromEmail,
        fromName: mockFromName,
      }));
      emailService = require('../services/email.service');

      const result = await emailService.verifyEmailConnection();

      expect(result).toBe(false);
    });

    test('should return false on connection error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await emailService.verifyEmailConnection();

      expect(result).toBe(false);
    });

    test('should return false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await emailService.verifyEmailConnection();

      expect(result).toBe(false);
    });
  });
});
