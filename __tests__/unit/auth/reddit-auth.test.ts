/**
 * Unit tests for RedditAuth
 */

import axios from 'axios';
import { RedditAuth } from '../../../src/auth/reddit-auth';
import { RedditConfig } from '../../../src/types/reddit';
import { AuthenticationError } from '../../../src/utils/error-handler';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RedditAuth', () => {
  let mockConfig: RedditConfig;
  let mockAuthClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      userAgent: 'TestBot/1.0',
      username: 'testuser',
      password: 'testpassword',
      refreshToken: 'test-refresh-token',
      rateLimitPerMinute: 60,
      maxRetries: 3,
    };

    mockAuthClient = {
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAuthClient as any);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const auth = new RedditAuth(mockConfig);

      expect(auth).toBeDefined();
      expect(auth.getRefreshToken()).toBe('test-refresh-token');
    });

    it('should create axios client with correct config', () => {
      new RedditAuth(mockConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://www.reddit.com',
          headers: expect.objectContaining({
            'User-Agent': 'TestBot/1.0',
          }),
          auth: {
            username: 'test-client-id',
            password: 'test-client-secret',
          },
        })
      );
    });

    it('should handle missing refresh token', () => {
      const configWithoutRefresh = { ...mockConfig, refreshToken: undefined };
      const auth = new RedditAuth(configWithoutRefresh);

      expect(auth.getRefreshToken()).toBeNull();
    });
  });

  describe('authenticateWithPassword', () => {
    it('should successfully authenticate with password', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      const token = await auth.authenticateWithPassword();

      expect(token).toBe('test-access-token');
      expect(mockAuthClient.post).toHaveBeenCalledWith(
        '/api/v1/access_token',
        expect.stringContaining('grant_type=password')
      );
    });

    it('should store access token and expiry', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should update refresh token if provided', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token',
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      expect(auth.getRefreshToken()).toBe('new-refresh-token');
    });

    it('should throw error when username missing', async () => {
      const configWithoutUsername = { ...mockConfig, username: undefined };
      const auth = new RedditAuth(configWithoutUsername);

      await expect(auth.authenticateWithPassword()).rejects.toThrow(AuthenticationError);
      await expect(auth.authenticateWithPassword()).rejects.toThrow('Username and password are required');
    });

    it('should throw error when password missing', async () => {
      const configWithoutPassword = { ...mockConfig, password: undefined };
      const auth = new RedditAuth(configWithoutPassword);

      await expect(auth.authenticateWithPassword()).rejects.toThrow(AuthenticationError);
    });

    it('should handle authentication failure', async () => {
      mockAuthClient.post.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
        isAxiosError: true,
      });

      const auth = new RedditAuth(mockConfig);

      await expect(auth.authenticateWithPassword()).rejects.toThrow();
    });
  });

  describe('authenticateWithRefreshToken', () => {
    it('should successfully authenticate with refresh token', async () => {
      const mockResponse = {
        data: {
          access_token: 'refreshed-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      const token = await auth.authenticateWithRefreshToken();

      expect(token).toBe('refreshed-access-token');
      expect(mockAuthClient.post).toHaveBeenCalledWith(
        '/api/v1/access_token',
        expect.stringContaining('grant_type=refresh_token')
      );
    });

    it('should throw error when no refresh token available', async () => {
      const configWithoutRefresh = { ...mockConfig, refreshToken: undefined };
      const auth = new RedditAuth(configWithoutRefresh);

      await expect(auth.authenticateWithRefreshToken()).rejects.toThrow(AuthenticationError);
      await expect(auth.authenticateWithRefreshToken()).rejects.toThrow('No refresh token available');
    });

    it('should handle refresh token failure', async () => {
      mockAuthClient.post.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid refresh token' },
        },
        isAxiosError: true,
      });

      const auth = new RedditAuth(mockConfig);

      await expect(auth.authenticateWithRefreshToken()).rejects.toThrow();
    });
  });

  describe('getAccessToken', () => {
    it('should return existing valid token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      // Clear mock to ensure it's not called again
      mockAuthClient.post.mockClear();

      const token = await auth.getAccessToken();

      expect(token).toBe('test-access-token');
      expect(mockAuthClient.post).not.toHaveBeenCalled();
    });

    it('should refresh token when expired', async () => {
      jest.useFakeTimers();

      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 60, // 1 minute
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      // Advance time past expiry
      jest.advanceTimersByTime(120000); // 2 minutes

      mockAuthClient.post.mockClear();
      mockAuthClient.post.mockResolvedValue({
        data: {
          access_token: 'refreshed-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      });

      const token = await auth.getAccessToken();

      expect(token).toBe('refreshed-token');
      expect(mockAuthClient.post).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should use refresh token if available', async () => {
      const auth = new RedditAuth(mockConfig);

      mockAuthClient.post.mockResolvedValue({
        data: {
          access_token: 'refreshed-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      });

      const token = await auth.getAccessToken();

      expect(token).toBe('refreshed-token');
      expect(mockAuthClient.post).toHaveBeenCalledWith(
        '/api/v1/access_token',
        expect.stringContaining('grant_type=refresh_token')
      );
    });

    it('should fallback to password auth if refresh fails', async () => {
      const auth = new RedditAuth(mockConfig);

      // First call (refresh) fails
      mockAuthClient.post.mockRejectedValueOnce({
        response: { status: 401, data: {} },
        isAxiosError: true,
      });

      // Second call (password) succeeds
      mockAuthClient.post.mockResolvedValueOnce({
        data: {
          access_token: 'password-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      });

      const token = await auth.getAccessToken();

      expect(token).toBe('password-token');
      expect(mockAuthClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when not authenticated', () => {
      const auth = new RedditAuth(mockConfig);

      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should return true when authenticated', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should return false when token expired', async () => {
      jest.useFakeTimers();

      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 60, // 1 minute
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      // Advance past expiry
      jest.advanceTimersByTime(120000);

      expect(auth.isAuthenticated()).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('refresh token management', () => {
    it('should get refresh token', () => {
      const auth = new RedditAuth(mockConfig);

      expect(auth.getRefreshToken()).toBe('test-refresh-token');
    });

    it('should set refresh token', () => {
      const auth = new RedditAuth(mockConfig);

      auth.setRefreshToken('new-refresh-token');

      expect(auth.getRefreshToken()).toBe('new-refresh-token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke access token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.authenticateWithPassword();

      mockAuthClient.post.mockClear();
      mockAuthClient.post.mockResolvedValue({});

      await auth.revokeToken();

      expect(mockAuthClient.post).toHaveBeenCalledWith(
        '/api/v1/revoke_token',
        expect.stringContaining('token=test-access-token')
      );
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should do nothing when no token to revoke', async () => {
      const auth = new RedditAuth(mockConfig);

      await auth.revokeToken();

      expect(mockAuthClient.post).not.toHaveBeenCalled();
    });
  });

  describe('createAuthenticatedClient', () => {
    it('should create axios client with bearer token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      };

      mockAuthClient.post.mockResolvedValue(mockResponse);

      const auth = new RedditAuth(mockConfig);
      await auth.createAuthenticatedClient();

      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: 'https://oauth.reddit.com',
        headers: {
          'User-Agent': 'TestBot/1.0',
          Authorization: 'Bearer test-access-token',
        },
      });
    });

    it('should authenticate if not already authenticated', async () => {
      mockAuthClient.post.mockResolvedValue({
        data: {
          access_token: 'new-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      });

      const auth = new RedditAuth(mockConfig);
      await auth.createAuthenticatedClient();

      expect(mockAuthClient.post).toHaveBeenCalled();
    });
  });
});
