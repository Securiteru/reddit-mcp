/**
 * Reddit OAuth2 authentication handler
 */

import axios, { AxiosInstance } from 'axios';
import { RedditAuthResponse, RedditConfig } from '../types/reddit.js';
import { AuthenticationError, parseRedditError } from '../utils/error-handler.js';

export class RedditAuth {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly config: RedditConfig;
  private readonly authClient: AxiosInstance;

  constructor(config: RedditConfig) {
    this.config = config;
    this.refreshToken = config.refreshToken || null;

    // Create axios instance for authentication requests
    this.authClient = axios.create({
      baseURL: 'https://www.reddit.com',
      headers: {
        'User-Agent': config.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: config.clientId,
        password: config.clientSecret,
      },
    });
  }

  /**
   * Authenticate using script-type application flow
   * Requires username and password
   */
  async authenticateWithPassword(): Promise<string> {
    if (!this.config.username || !this.config.password) {
      throw new AuthenticationError(
        'Username and password are required for script authentication'
      );
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'password',
        username: this.config.username,
        password: this.config.password,
      });

      const response = await this.authClient.post<RedditAuthResponse>(
        '/api/v1/access_token',
        params.toString()
      );

      return this.handleAuthResponse(response.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Authenticate using refresh token
   */
  async authenticateWithRefreshToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      });

      const response = await this.authClient.post<RedditAuthResponse>(
        '/api/v1/access_token',
        params.toString()
      );

      return this.handleAuthResponse(response.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthResponse(data: RedditAuthResponse): string {
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    return this.accessToken;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    // Try to refresh using refresh token first
    if (this.refreshToken) {
      try {
        return await this.authenticateWithRefreshToken();
      } catch (error) {
        // If refresh fails, fall back to password auth
        console.error('Failed to refresh token, trying password auth:', error);
      }
    }

    // Fall back to password authentication
    return await this.authenticateWithPassword();
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && Date.now() < this.tokenExpiry;
  }

  /**
   * Get the refresh token (useful for storing)
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Manually set a refresh token
   */
  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  /**
   * Revoke the current access token
   */
  async revokeToken(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const params = new URLSearchParams({
        token: this.accessToken,
        token_type_hint: 'access_token',
      });

      await this.authClient.post('/api/v1/revoke_token', params.toString());

      this.accessToken = null;
      this.tokenExpiry = 0;
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Create an authenticated axios instance for API requests
   */
  async createAuthenticatedClient(): Promise<AxiosInstance> {
    const token = await this.getAccessToken();

    return axios.create({
      baseURL: 'https://oauth.reddit.com',
      headers: {
        'User-Agent': this.config.userAgent,
        Authorization: `Bearer ${token}`,
      },
    });
  }
}
