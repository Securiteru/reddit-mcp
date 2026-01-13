/**
 * Integration tests for RedditReadTools
 */

import { AxiosInstance } from 'axios';
import { RedditReadTools } from '../../src/tools/read';
import {
  RedditPost,
  RedditComment,
  RedditPostListing,
  RedditCommentListing,
} from '../../src/types/reddit';
import {
  createMockPost,
  createMockPostListing,
} from '../helpers/mock-data';

describe('RedditReadTools', () => {
  let mockClient: jest.Mocked<AxiosInstance>;
  let readTools: RedditReadTools;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
    } as any;

    readTools = new RedditReadTools(mockClient);
  });

  describe('getPost', () => {
    it('should fetch post by ID', async () => {
      const mockPost: RedditPost = {
        id: 'abc123',
        title: 'Test Post',
        author: 'testuser',
        subreddit: 'test',
        selftext: 'Test content',
        score: 100,
        num_comments: 10,
        created_utc: 1234567890,
        permalink: '/r/test/comments/abc123/test_post',
        url: 'https://reddit.com/r/test/comments/abc123',
      } as RedditPost;

      const mockResponse: RedditPostListing = {
        kind: 'Listing',
        data: {
          children: [{ kind: 't3', data: mockPost }],
          after: null,
          before: null,
        },
      };

      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await readTools.getPost('abc123');

      expect(result).toEqual(mockPost);
      expect(mockClient.get).toHaveBeenCalledWith('/api/info', {
        params: { id: 't3_abc123' },
      });
    });

    it('should handle ID with t3_ prefix', async () => {
      const mockPost = createMockPost({ id: 'abc123' });
      const mockResponse = createMockPostListing([mockPost]);

      mockClient.get.mockResolvedValue({ data: mockResponse });

      await readTools.getPost('t3_abc123');

      expect(mockClient.get).toHaveBeenCalledWith('/api/info', {
        params: { id: 't3_abc123' },
      });
    });

    it('should throw error when post not found', async () => {
      const mockResponse = createMockPostListing([]);

      mockClient.get.mockResolvedValue({ data: mockResponse });

      await expect(readTools.getPost('nonexistent')).rejects.toThrow('Post not found');
    });
  });

  describe('getComments', () => {
    it('should fetch comments for a post', async () => {
      const mockPost: RedditPost = {
        id: 'abc123',
        title: 'Test Post',
      } as RedditPost;

      const mockComment: RedditComment = {
        id: 'comment1',
        body: 'Test comment',
        author: 'commenter',
        score: 5,
        created_utc: 1234567890,
      } as RedditComment;

      const mockPostListing: RedditPostListing = {
        kind: 'Listing',
        data: {
          children: [{ kind: 't3', data: mockPost }],
          after: null,
          before: null,
        },
      };

      const mockCommentListing: RedditCommentListing = {
        kind: 'Listing',
        data: {
          children: [{ kind: 't1', data: mockComment }],
          after: null,
          before: null,
        },
      };

      mockClient.get.mockResolvedValue({
        data: [mockPostListing, mockCommentListing],
      });

      const result = await readTools.getComments('abc123');

      expect(result.post).toEqual(mockPost);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment1');
      expect(mockClient.get).toHaveBeenCalledWith('/comments/abc123', {
        params: {
          sort: 'confidence',
          limit: 100,
          depth: 10,
        },
      });
    });

    it('should support custom sort and limit options', async () => {
      mockClient.get.mockResolvedValue({
        data: [
          { kind: 'Listing', data: { children: [{ kind: 't3', data: {} }] } },
          { kind: 'Listing', data: { children: [] } },
        ],
      });

      await readTools.getComments('abc123', {
        sort: 'top',
        limit: 50,
        depth: 5,
      });

      expect(mockClient.get).toHaveBeenCalledWith('/comments/abc123', {
        params: {
          sort: 'top',
          limit: 50,
          depth: 5,
        },
      });
    });

    it('should flatten nested comment replies', async () => {
      const mockPost: RedditPost = { id: 'abc123' } as RedditPost;

      const parentComment = {
        id: 'parent',
        body: 'Parent comment',
        replies: {
          kind: 'Listing',
          data: {
            children: [
              {
                kind: 't1',
                data: {
                  id: 'child',
                  body: 'Child comment',
                },
              },
            ],
          },
        },
      };

      const mockPostListing: RedditPostListing = {
        kind: 'Listing',
        data: {
          children: [{ kind: 't3', data: mockPost }],
          after: null,
          before: null,
        },
      };

      const mockCommentListing: RedditCommentListing = {
        kind: 'Listing',
        data: {
          children: [{ kind: 't1', data: parentComment as any }],
          after: null,
          before: null,
        },
      };

      mockClient.get.mockResolvedValue({
        data: [mockPostListing, mockCommentListing],
      });

      const result = await readTools.getComments('abc123');

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].depth).toBe(0);
      expect(result.comments[1].depth).toBe(1);
    });
  });

  describe('searchPosts', () => {
    it('should search posts with query', async () => {
      const mockPosts: RedditPost[] = [
        { id: 'post1', title: 'Result 1' } as RedditPost,
        { id: 'post2', title: 'Result 2' } as RedditPost,
      ];

      const mockResponse: RedditPostListing = {
        kind: 'Listing',
        data: {
          children: mockPosts.map((p) => ({ kind: 't3' as const, data: p })),
          after: null,
          before: null,
        },
      };

      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await readTools.searchPosts({ query: 'test query' });

      expect(result).toHaveLength(2);
      expect(mockClient.get).toHaveBeenCalledWith('/search', {
        params: {
          q: 'test query',
          restrict_sr: undefined,
          sort: 'relevance',
          t: 'all',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should search within specific subreddit', async () => {
      mockClient.get.mockResolvedValue({
        data: { kind: 'Listing', data: { children: [] } },
      });

      await readTools.searchPosts({
        query: 'test',
        subreddit: 'programming',
      });

      expect(mockClient.get).toHaveBeenCalledWith('/r/programming/search', {
        params: {
          q: 'test',
          restrict_sr: true,
          sort: 'relevance',
          t: 'all',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support custom sort, time, and limit', async () => {
      mockClient.get.mockResolvedValue({
        data: { kind: 'Listing', data: { children: [] } },
      });

      await readTools.searchPosts({
        query: 'test',
        sort: 'top',
        time: 'week',
        limit: 50,
      });

      expect(mockClient.get).toHaveBeenCalledWith('/search', {
        params: {
          q: 'test',
          restrict_sr: undefined,
          sort: 'top',
          t: 'week',
          limit: 50,
          after: undefined,
        },
      });
    });
  });

  describe('getSubredditPosts', () => {
    it('should fetch subreddit posts', async () => {
      const mockPosts: RedditPost[] = [
        { id: 'post1', title: 'Hot Post' } as RedditPost,
      ];

      const mockResponse: RedditPostListing = {
        kind: 'Listing',
        data: {
          children: mockPosts.map((p) => ({ kind: 't3' as const, data: p })),
          after: null,
          before: null,
        },
      };

      mockClient.get.mockResolvedValue({ data: mockResponse });

      const result = await readTools.getSubredditPosts('programming');

      expect(result).toHaveLength(1);
      expect(mockClient.get).toHaveBeenCalledWith('/r/programming/hot', {
        params: {
          t: 'day',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support different sort options', async () => {
      mockClient.get.mockResolvedValue({
        data: { kind: 'Listing', data: { children: [] } },
      });

      await readTools.getSubredditPosts('programming', { sort: 'top' });

      expect(mockClient.get).toHaveBeenCalledWith('/r/programming/top', {
        params: {
          t: 'day',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support custom time, limit, and pagination', async () => {
      mockClient.get.mockResolvedValue({
        data: { kind: 'Listing', data: { children: [] } },
      });

      await readTools.getSubredditPosts('programming', {
        time: 'week',
        limit: 100,
        after: 't3_abc123',
      });

      expect(mockClient.get).toHaveBeenCalledWith('/r/programming/hot', {
        params: {
          t: 'week',
          limit: 100,
          after: 't3_abc123',
        },
      });
    });
  });

  describe('getSubreddit', () => {
    it('should fetch subreddit information', async () => {
      const mockSubreddit = {
        display_name: 'programming',
        title: 'Programming',
        subscribers: 1000000,
        public_description: 'Computer Programming',
      };

      mockClient.get.mockResolvedValue({
        data: { data: mockSubreddit },
      });

      const result = await readTools.getSubreddit('programming');

      expect(result).toEqual(mockSubreddit);
      expect(mockClient.get).toHaveBeenCalledWith('/r/programming/about');
    });
  });

  describe('getUserContent', () => {
    it('should fetch user content with defaults', async () => {
      const mockContent = [
        { id: 'post1', title: 'User Post' },
        { id: 'comment1', body: 'User Comment' },
      ];

      mockClient.get.mockResolvedValue({
        data: {
          data: {
            children: mockContent.map((c) => ({ kind: 't3', data: c })),
          },
        },
      });

      const result = await readTools.getUserContent('testuser');

      expect(result).toHaveLength(2);
      expect(mockClient.get).toHaveBeenCalledWith('/user/testuser/overview', {
        params: {
          sort: 'new',
          t: 'all',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support filtering by content type', async () => {
      mockClient.get.mockResolvedValue({
        data: { data: { children: [] } },
      });

      await readTools.getUserContent('testuser', { type: 'submitted' });

      expect(mockClient.get).toHaveBeenCalledWith('/user/testuser/submitted', {
        params: {
          sort: 'new',
          t: 'all',
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support custom sort and time options', async () => {
      mockClient.get.mockResolvedValue({
        data: { data: { children: [] } },
      });

      await readTools.getUserContent('testuser', {
        type: 'comments',
        sort: 'top',
        time: 'year',
        limit: 50,
      });

      expect(mockClient.get).toHaveBeenCalledWith('/user/testuser/comments', {
        params: {
          sort: 'top',
          t: 'year',
          limit: 50,
          after: undefined,
        },
      });
    });
  });

  describe('getSaved', () => {
    it('should fetch saved items', async () => {
      const mockSaved = [
        { id: 'saved1', title: 'Saved Post' },
        { id: 'saved2', body: 'Saved Comment' },
      ];

      mockClient.get.mockResolvedValue({
        data: {
          data: {
            children: mockSaved.map((s) => ({ kind: 't3', data: s })),
          },
        },
      });

      const result = await readTools.getSaved();

      expect(result).toHaveLength(2);
      expect(mockClient.get).toHaveBeenCalledWith('/user/me/saved', {
        params: {
          limit: 25,
          after: undefined,
        },
      });
    });

    it('should support pagination', async () => {
      mockClient.get.mockResolvedValue({
        data: { data: { children: [] } },
      });

      await readTools.getSaved({ limit: 100, after: 't3_abc123' });

      expect(mockClient.get).toHaveBeenCalledWith('/user/me/saved', {
        params: {
          limit: 100,
          after: 't3_abc123',
        },
      });
    });
  });

  describe('getMe', () => {
    it('should fetch current user info', async () => {
      const mockUserData = {
        name: 'testuser',
        link_karma: 1000,
        comment_karma: 5000,
        created_utc: 1234567890,
      };

      mockClient.get.mockResolvedValue({ data: mockUserData });

      const result = await readTools.getMe();

      expect(result).toEqual(mockUserData);
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/me');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockClient.get.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
        isAxiosError: true,
      });

      await expect(readTools.getPost('nonexistent')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(readTools.getSubreddit('test')).rejects.toThrow();
    });
  });
});
