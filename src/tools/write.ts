/**
 * Reddit writing tools - submit posts, comments, votes, etc.
 */

import { AxiosInstance } from 'axios';
import {
  SubmitPostParams,
  SubmitCommentParams,
  VoteParams,
} from '../types/reddit.js';
import { parseRedditError } from '../utils/error-handler.js';

export class RedditWriteTools {
  constructor(private readonly client: AxiosInstance) {}

  /**
   * Submit a new post to a subreddit
   */
  async submitPost(params: SubmitPostParams): Promise<{ id: string; name: string; url: string }> {
    try {
      const formData = new URLSearchParams({
        api_type: 'json',
        sr: params.subreddit,
        title: params.title,
        kind: params.url ? 'link' : 'self',
        sendreplies: String(params.send_replies ?? true),
        nsfw: String(params.nsfw ?? false),
        spoiler: String(params.spoiler ?? false),
      });

      // Add content based on type
      if (params.url) {
        formData.append('url', params.url);
      } else if (params.text) {
        formData.append('text', params.text);
      }

      // Add optional flair
      if (params.flair_id) {
        formData.append('flair_id', params.flair_id);
      }

      const response = await this.client.post('/api/submit', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = response.data.json.data;
      return {
        id: data.id,
        name: data.name,
        url: data.url,
      };
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Submit a comment in reply to a post or another comment
   */
  async submitComment(params: SubmitCommentParams): Promise<{ id: string; name: string }> {
    try {
      const formData = new URLSearchParams({
        api_type: 'json',
        thing_id: params.parent,
        text: params.text,
      });

      const response = await this.client.post('/api/comment', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const comment = response.data.json.data.things[0].data;
      return {
        id: comment.id,
        name: comment.name,
      };
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Edit a post or comment
   */
  async editContent(thingId: string, text: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        api_type: 'json',
        thing_id: thingId,
        text: text,
      });

      await this.client.post('/api/editusertext', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Delete a post or comment
   */
  async deleteContent(thingId: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: thingId,
      });

      await this.client.post('/api/del', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Vote on a post or comment
   * dir: 1 = upvote, 0 = remove vote, -1 = downvote
   */
  async vote(params: VoteParams): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: params.id,
        dir: String(params.dir),
      });

      await this.client.post('/api/vote', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Save a post or comment
   */
  async save(thingId: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: thingId,
      });

      await this.client.post('/api/save', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Unsave a post or comment
   */
  async unsave(thingId: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: thingId,
      });

      await this.client.post('/api/unsave', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Hide a post
   */
  async hide(thingId: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: thingId,
      });

      await this.client.post('/api/hide', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Unhide a post
   */
  async unhide(thingId: string): Promise<void> {
    try {
      const formData = new URLSearchParams({
        id: thingId,
      });

      await this.client.post('/api/unhide', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Report a post or comment
   */
  async report(
    thingId: string,
    reason: string,
    options?: {
      site_reason?: string;
      additional_info?: string;
    }
  ): Promise<void> {
    try {
      const formData = new URLSearchParams({
        thing_id: thingId,
        reason: reason,
      });

      if (options?.site_reason) {
        formData.append('site_reason', options.site_reason);
      }

      if (options?.additional_info) {
        formData.append('additional_info', options.additional_info);
      }

      await this.client.post('/api/report', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw parseRedditError(error);
    }
  }
}
