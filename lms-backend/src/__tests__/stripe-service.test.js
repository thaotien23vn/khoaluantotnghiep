/**
 * Stripe Service Tests
 * Tests for stripe.service.js with mocked Stripe API
 */

// Mock Stripe module
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock database models
jest.mock('../models', () => ({
  models: {
    Payment: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
    Course: {
      findByPk: jest.fn(),
    },
    Enrollment: {
      findOne: jest.fn(),
      create: jest.fn(),
    },
  },
  sequelize: {
    transaction: jest.fn((cb) => cb({})),
  },
}));

// Mock course aggregates service
jest.mock('../services/courseAggregates.service', () => ({
  recomputeCourseStudents: jest.fn(),
}));

describe('Stripe Service Tests', () => {
  let stripeService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';

    // Reload stripe service to get fresh instance
    jest.resetModules();
    stripeService = require('../services/stripe.service');
  });

  describe('_calculateExpiryDate', () => {
    test('should calculate expiry for days', () => {
      const startDate = new Date('2024-01-01');
      const result = stripeService._calculateExpiryDate(startDate, 7, 'days');
      expect(result.getDate()).toBe(8);
      expect(result.getMonth()).toBe(0);
    });

    test('should calculate expiry for months', () => {
      const startDate = new Date('2024-01-01');
      const result = stripeService._calculateExpiryDate(startDate, 3, 'months');
      // ~91 days added
      expect(result.getMonth()).toBeGreaterThan(0);
    });

    test('should calculate expiry for years', () => {
      const startDate = new Date('2024-01-01');
      const result = stripeService._calculateExpiryDate(startDate, 2, 'years');
      expect(result.getFullYear()).toBe(2026);
    });
  });

  describe('_addDays', () => {
    test('should add days to date', () => {
      const startDate = new Date('2024-01-01');
      const result = stripeService._addDays(startDate, 10);
      expect(result.getDate()).toBe(11);
    });
  });

  describe('createPaymentIntent', () => {
    test('should throw error when course not found', async () => {
      const { Course } = require('../models').models;
      Course.findByPk.mockResolvedValue(null);

      await expect(
        stripeService.createPaymentIntent(1, 999999)
      ).rejects.toMatchObject({ status: 404 });
    });

    test('should throw error when course not published', async () => {
      const { Course } = require('../models').models;
      Course.findByPk.mockResolvedValue({
        id: 1,
        published: false,
        price: 100000,
      });

      await expect(
        stripeService.createPaymentIntent(1, 1)
      ).rejects.toMatchObject({ status: 400 });
    });

    test('should throw error for free course', async () => {
      const { Course } = require('../models').models;
      Course.findByPk.mockResolvedValue({
        id: 1,
        published: true,
        price: 0,
      });

      await expect(
        stripeService.createPaymentIntent(1, 1)
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
