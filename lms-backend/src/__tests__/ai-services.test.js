/**
 * AI Services Tests - Pure Unit Test Pattern
 * All external dependencies mocked: fetch, logger, database
 */

// Mock database models FIRST (before any imports)
const mockAiSettingFindOne = jest.fn();
const mockAiRolePolicyFindOne = jest.fn();
const mockAiPromptTemplateFindOne = jest.fn();
const mockAiAuditLogCreate = jest.fn();

jest.mock('../models', () => ({
  models: {
    AiSetting: {
      findOne: mockAiSettingFindOne,
    },
    AiRolePolicy: {
      findOne: mockAiRolePolicyFindOne,
    },
    AiPromptTemplate: {
      findOne: mockAiPromptTemplateFindOne,
    },
    AiAuditLog: {
      create: mockAiAuditLogCreate,
    },
  },
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(() => ({
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
  },
}));

// Mock axios for AI API calls
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('axios', () => ({
  get: mockAxiosGet,
  post: mockAxiosPost,
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('AI Services Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('AI Policy Service', () => {
    test('should export AI settings and role policy functions', () => {
      const aiPolicy = require('../services/aiPolicy.service');
      expect(aiPolicy).toBeDefined();
      expect(aiPolicy.getAiSetting).toBeInstanceOf(Function);
      expect(aiPolicy.getRolePolicy).toBeInstanceOf(Function);
    });

    test('should get AI settings from database', async () => {
      const aiPolicy = require('../services/aiPolicy.service');
      
      // Mock DB response
      mockAiSettingFindOne.mockResolvedValue({
        key: 'defaultModel',
        value: 'gemini-1.5-flash',
        enabled: true,
      });

      const settings = await aiPolicy.getAiSetting('defaultModel');
      expect(settings).toBeDefined();
      expect(mockAiSettingFindOne).toHaveBeenCalled();
    });

    test('should get role policy from database', async () => {
      const aiPolicy = require('../services/aiPolicy.service');
      
      // Mock DB response
      mockAiRolePolicyFindOne.mockResolvedValue({
        role: 'teacher',
        allowedModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
        maxTokensPerDay: 10000,
      });

      const policy = await aiPolicy.getRolePolicy('teacher');
      expect(policy).toBeDefined();
      expect(mockAiRolePolicyFindOne).toHaveBeenCalled();
    });
  });

  describe('AI Prompt Service', () => {
    test('should export template function', () => {
      const aiPrompt = require('../services/aiPrompt.service');
      expect(aiPrompt).toBeDefined();
      expect(aiPrompt.getTemplateOrDefault).toBeInstanceOf(Function);
    });

    test('should get template from database', async () => {
      const aiPrompt = require('../services/aiPrompt.service');
      
      // Mock DB response
      mockAiPromptTemplateFindOne.mockResolvedValue({
        name: 'default',
        template: 'You are a helpful assistant. {{content}}',
        variables: ['content'],
      });

      const template = await aiPrompt.getTemplateOrDefault('default');
      expect(template).toBeDefined();
      expect(mockAiPromptTemplateFindOne).toHaveBeenCalled();
    });
  });

  describe('AI Audit Service', () => {
    test('should log AI call to database', async () => {
      const aiAudit = require('../services/aiAudit.service');
      
      // Mock DB create
      mockAiAuditLogCreate.mockResolvedValue({ id: 1 });

      await aiAudit.logAiCall({
        userId: 1,
        role: 'teacher',
        endpoint: 'generateContent',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        status: 'ok',
        inputTokens: 100,
        outputTokens: 200,
      });

      expect(mockAiAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1,
        role: 'teacher',
        provider: 'gemini',
      }));
    });
  });

  describe('AI Gateway Service', () => {
    beforeEach(() => {
      mockAxiosPost.mockResolvedValue({
        data: {
          candidates: [{
            content: {
              parts: [{ text: 'Generated response' }]
            }
          }]
        },
        status: 200,
      });
    });

    test('should export AI functions', () => {
      const aiGateway = require('../services/aiGateway.service');
      expect(aiGateway).toBeDefined();
      expect(aiGateway.generateText).toBeInstanceOf(Function);
      expect(aiGateway.embedText).toBeInstanceOf(Function);
    });

    test('should provide API key count', () => {
      const aiGateway = require('../services/aiGateway.service');
      const count = aiGateway.getApiKeyCount();
      expect(typeof count).toBe('number');
    });

    test('should provide circuit breaker state', () => {
      const aiGateway = require('../services/aiGateway.service');
      const state = aiGateway.getCircuitBreakerState();
      expect(state).toBeDefined();
      expect(state.state).toBeDefined();
    });

    test('should call external AI API via axios', async () => {
      const aiGateway = require('../services/aiGateway.service');
      
      const result = await aiGateway.generateText('Test prompt', {
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      });

      expect(mockAxiosPost).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Difficulty Mapper', () => {
    test('should map difficulty to CEFR levels', () => {
      const difficultyMapper = require('../utils/difficultyMapper');

      const a1 = difficultyMapper.getCefrLevel('easy');
      expect(['A1', 'A2']).toContain(a1);

      const b1 = difficultyMapper.getCefrLevel('medium');
      expect(['B1', 'B2']).toContain(b1);

      const c1 = difficultyMapper.getCefrLevel('hard');
      expect(['C1', 'C2']).toContain(c1);
    });

    test('should map quiz difficulty to CEFR', () => {
      const difficultyMapper = require('../utils/difficultyMapper');
      const result = difficultyMapper.mapQuizDifficultyToCefr('medium');
      expect(['B1', 'B2']).toContain(result);
    });

    test('should get CEFR range for difficulty', () => {
      const difficultyMapper = require('../utils/difficultyMapper');
      const range = difficultyMapper.getCefrRange('medium');
      expect(range).toEqual(['B1', 'B2']);
    });
  });

  describe('AI Content Service', () => {
    beforeEach(() => {
      mockAxiosPost.mockResolvedValue({
        data: {
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({ content: 'Generated content' }) }]
            }
          }]
        },
        status: 200,
      });
    });

    test('should export content generation functions', () => {
      const aiContent = require('../services/aiContent.service');
      expect(aiContent).toBeDefined();
      expect(typeof aiContent).toBe('object');
    });
  });

  describe('AI RAG Service', () => {
    test('should export RAG functions', () => {
      const aiRag = require('../services/aiRag.service');
      expect(aiRag).toBeDefined();
      expect(typeof aiRag).toBe('object');
    });
  });
});
