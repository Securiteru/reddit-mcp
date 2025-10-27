/**
 * Reddit reading tools - fetch posts, comments, subreddits, etc.
 */

import { AxiosInstance } from 'axios';
import {
  RedditPost,
  RedditComment,
  RedditPostListing,
  RedditCommentListing,
  RedditSubreddit,
  SearchParams,
} from '../types/reddit.js';
import { parseRedditError } from '../utils/error-handler.js';

export class RedditReadTools {
  constructor(private readonly client: AxiosInstance) {}

  /**
   * Get a post by ID or full name (t3_xxxxx)
   */
  async getPost(id: string): Promise<RedditPost> {
    try {
      // Remove 't3_' prefix if present
      const postId = id.replace(/^t3_/, '');

      const response = await this.client.get(`/api/info`, {
        params: { id: `t3_${postId}` },
      });

      const listing = response.data as RedditPostListing;
      if (listing.data.children.length === 0) {
        throw new Error(`Post not found: ${id}`);
      }

      return listing.data.children[0].data;
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get comments for a post
   */
  async getComments(
    postId: string,
    options: {
      sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
      limit?: number;
      depth?: number;
    } = {}
  ): Promise<{ post: RedditPost; comments: RedditComment[] }> {
    try {
      // Remove 't3_' prefix if present
      const cleanPostId = postId.replace(/^t3_/, '');

      const response = await this.client.get(`/comments/${cleanPostId}`, {
        params: {
          sort: options.sort || 'confidence',
          limit: options.limit || 100,
          depth: options.depth || 10,
        },
      });

      // Reddit returns [post_listing, comments_listing]
      const [postListing, commentsListing] = response.data as [
        RedditPostListing,
        RedditCommentListing
      ];

      const post = postListing.data.children[0].data;
      const comments = this.flattenComments(commentsListing);

      return { post, comments };
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Flatten nested comment structure
   */
  private flattenComments(listing: RedditCommentListing): RedditComment[] {
    const comments: RedditComment[] = [];

    const processComment = (item: any, depth: number = 0) => {
      if (item.kind === 't1') {
        const comment = { ...item.data, depth };
        comments.push(comment);

        // Process replies
        if (comment.replies && typeof comment.replies === 'object') {
          const repliesListing = comment.replies as RedditCommentListing;
          if (repliesListing.data?.children) {
            repliesListing.data.children.forEach((reply) =>
              processComment(reply, depth + 1)
            );
          }
        }
      }
    };

    listing.data.children.forEach((item) => processComment(item));
    return comments;
  }

  /**
   * Search for posts
   */
  async searchPosts(params: SearchParams): Promise<RedditPost[]> {
    try {
      const endpoint = params.subreddit
        ? `/r/${params.subreddit}/search`
        : '/search';

      const response = await this.client.get(endpoint, {
        params: {
          q: params.query,
          restrict_sr: params.subreddit ? true : undefined,
          sort: params.sort || 'relevance',
          t: params.time || 'all',
          limit: params.limit || 25,
          after: params.after,
        },
      });

      const listing = response.data as RedditPostListing;
      return listing.data.children.map((child) => child.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get posts from a subreddit
   */
  async getSubredditPosts(
    subreddit: string,
    options: {
      sort?: 'hot' | 'new' | 'rising' | 'top' | 'controversial';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<RedditPost[]> {
    try {
      const sortPath = options.sort || 'hot';
      const endpoint = `/r/${subreddit}/${sortPath}`;

      const response = await this.client.get(endpoint, {
        params: {
          t: options.time || 'day',
          limit: options.limit || 25,
          after: options.after,
        },
      });

      const listing = response.data as RedditPostListing;
      return listing.data.children.map((child) => child.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get subreddit information
   */
  async getSubreddit(subreddit: string): Promise<RedditSubreddit> {
    try {
      const response = await this.client.get(`/r/${subreddit}/about`);
      return response.data.data as RedditSubreddit;
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get user's posts and comments
   */
  async getUserContent(
    username: string,
    options: {
      type?: 'submitted' | 'comments' | 'overview';
      sort?: 'hot' | 'new' | 'top' | 'controversial';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<(RedditPost | RedditComment)[]> {
    try {
      const contentType = options.type || 'overview';
      const endpoint = `/user/${username}/${contentType}`;

      const response = await this.client.get(endpoint, {
        params: {
          sort: options.sort || 'new',
          t: options.time || 'all',
          limit: options.limit || 25,
          after: options.after,
        },
      });

      const listing = response.data;
      return listing.data.children.map((child: any) => child.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get saved posts and comments
   */
  async getSaved(options: {
    limit?: number;
    after?: string;
  } = {}): Promise<(RedditPost | RedditComment)[]> {
    try {
      const response = await this.client.get('/user/me/saved', {
        params: {
          limit: options.limit || 25,
          after: options.after,
        },
      });

      const listing = response.data;
      return listing.data.children.map((child: any) => child.data);
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Get user's info (current authenticated user)
   */
  async getMe(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/me');
      return response.data;
    } catch (error) {
      throw parseRedditError(error);
    }
  }
}
