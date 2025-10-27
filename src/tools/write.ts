/**
 * Reddit writing tools - submit posts, comments, votes, etc.
 */

import axios, { AxiosInstance } from 'axios';
import {
  SubmitPostParams,
  SubmitCommentParams,
  VoteParams,
  RedditMediaUploadLease,
} from '../types/reddit.js';
import { parseRedditError } from '../utils/error-handler.js';
import { uploadImage } from '../utils/image-upload.js';
import FormData from 'form-data';

export class RedditWriteTools {
  constructor(
    private readonly client: AxiosInstance,
    private readonly imgbbApiKey?: string
  ) {}

  /**
   * Upload an image to Reddit's media service
   * @param imageUrl - URL of the image to upload
   * @returns The media asset URL to use in post submission
   */
  private async uploadImage(imageUrl: string): Promise<string> {
    try {
      // Step 1: Fetch the image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Determine mimetype from Content-Type header or URL extension
      let mimetype = imageResponse.headers['content-type'] || 'image/jpeg';
      if (!mimetype.startsWith('image/')) {
        const ext = imageUrl.split('.').pop()?.toLowerCase();
        mimetype = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      }

      // Step 2: Request upload lease from Reddit
      const leaseResponse = await this.client.post<RedditMediaUploadLease>(
        '/api/media/asset.json',
        new URLSearchParams({
          filepath: `image.${mimetype.split('/')[1]}`,
          mimetype: mimetype,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const lease = leaseResponse.data;
      const uploadUrl = lease.upload_lease.action;
      const fields = lease.upload_lease.fields;

      // Step 3: Upload image to S3
      const formData = new FormData();

      // Add all fields from the lease
      fields.forEach((field) => {
        formData.append(field.name, field.value);
      });

      // Add the file
      formData.append('file', imageBuffer, {
        filename: `image.${mimetype.split('/')[1]}`,
        contentType: mimetype,
      });

      await axios.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Return the media asset URL
      return lease.asset.asset_id;
    } catch (error) {
      throw parseRedditError(error);
    }
  }

  /**
   * Submit a new post to a subreddit
   */
  async submitPost(params: SubmitPostParams): Promise<{ id: string; name: string; url: string }> {
    try {
      let finalImageUrl: string | undefined;

      // Handle base64 image data (local files)
      if (params.image_data) {
        console.log('Uploading base64 image to hosting service...');
        const imageBuffer = Buffer.from(params.image_data, 'base64');
        const filename = params.image_filename || 'image.jpg';

        const uploadResult = await uploadImage(imageBuffer, filename, this.imgbbApiKey);
        finalImageUrl = uploadResult.url;
        console.log(`Image uploaded to ${uploadResult.service}: ${finalImageUrl}`);
      } else if (params.image_url) {
        // Use provided URL directly
        finalImageUrl = params.image_url;
      }

      // Upload image to Reddit if we have a URL
      let mediaAssetId: string | undefined;
      if (finalImageUrl) {
        mediaAssetId = await this.uploadImage(finalImageUrl);
      }

      // Determine post kind
      let kind = 'self';
      if (mediaAssetId) {
        kind = 'image';
      } else if (params.url) {
        kind = 'link';
      }

      const formData = new URLSearchParams({
        api_type: 'json',
        sr: params.subreddit,
        title: params.title,
        kind: kind,
        sendreplies: String(params.send_replies ?? true),
        nsfw: String(params.nsfw ?? false),
        spoiler: String(params.spoiler ?? false),
      });

      // Add content based on type
      if (mediaAssetId) {
        formData.append('url', mediaAssetId);
      } else if (params.url) {
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
