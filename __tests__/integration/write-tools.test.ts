/**
 * Integration tests for RedditWriteTools
 */

import axios from 'axios';
import { AxiosInstance } from 'axios';
import { RedditWriteTools } from '../../src/tools/write';

// Mock axios for external image fetching
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RedditWriteTools', () => {
  let mockClient: jest.Mocked<AxiosInstance>;
  let writeTools: RedditWriteTools;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      post: jest.fn(),
    } as any;

    writeTools = new RedditWriteTools(mockClient);
  });

  describe('submitPost', () => {
    it('should submit a text post', async () => {
      const mockResponse = {
        data: {
          json: {
            data: {
              id: 'abc123',
              name: 't3_abc123',
              url: 'https://reddit.com/r/test/comments/abc123',
            },
          },
        },
      };

      mockClient.post.mockResolvedValue(mockResponse);

      const result = await writeTools.submitPost({
        subreddit: 'test',
        title: 'Test Post',
        text: 'Test content',
      });

      expect(result).toEqual({
        id: 'abc123',
        name: 't3_abc123',
        url: 'https://reddit.com/r/test/comments/abc123',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/submit',
        expect.stringContaining('kind=self'),
        expect.any(Object)
      );
    });

    it('should submit a link post', async () => {
      const mockResponse = {
        data: {
          json: {
            data: {
              id: 'def456',
              name: 't3_def456',
              url: 'https://reddit.com/r/test/comments/def456',
            },
          },
        },
      };

      mockClient.post.mockResolvedValue(mockResponse);

      await writeTools.submitPost({
        subreddit: 'test',
        title: 'Link Post',
        url: 'https://example.com',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/submit',
        expect.stringContaining('kind=link'),
        expect.any(Object)
      );
    });

    it('should support NSFW and spoiler flags', async () => {
      const mockResponse = {
        data: {
          json: {
            data: {
              id: 'ghi789',
              name: 't3_ghi789',
              url: 'https://reddit.com/r/test/comments/ghi789',
            },
          },
        },
      };

      mockClient.post.mockResolvedValue(mockResponse);

      await writeTools.submitPost({
        subreddit: 'test',
        title: 'Test Post',
        text: 'Content',
        nsfw: true,
        spoiler: true,
      });

      const callArgs = mockClient.post.mock.calls[0][1] as string;
      expect(callArgs).toContain('nsfw=true');
      expect(callArgs).toContain('spoiler=true');
    });

    it('should handle image upload for image posts', async () => {
      // Mock external image fetch
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' },
      } as any);

      // Mock upload lease request
      mockClient.post.mockResolvedValueOnce({
        data: {
          asset: {
            asset_id: 'media-id-123',
          },
          upload_lease: {
            action: 'https://s3.amazonaws.com/upload',
            fields: [
              { name: 'key', value: 'test-key' },
              { name: 'acl', value: 'private' },
            ],
          },
        },
      });

      // Mock S3 upload
      mockedAxios.post.mockResolvedValueOnce({} as any);

      // Mock final post submission
      mockClient.post.mockResolvedValueOnce({
        data: {
          json: {
            data: {
              id: 'img123',
              name: 't3_img123',
              url: 'https://reddit.com/r/test/comments/img123',
            },
          },
        },
      });

      await writeTools.submitPost({
        subreddit: 'test',
        title: 'Image Post',
        image_url: 'https://example.com/image.jpg',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        { responseType: 'arraybuffer' }
      );
      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/media/asset.json',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('submitComment', () => {
    it('should submit a comment on a post', async () => {
      const mockResponse = {
        data: {
          json: {
            data: {
              things: [
                {
                  data: {
                    id: 'comment123',
                    name: 't1_comment123',
                  },
                },
              ],
            },
          },
        },
      };

      mockClient.post.mockResolvedValue(mockResponse);

      const result = await writeTools.submitComment({
        parent: 't3_post123',
        text: 'Great post!',
      });

      expect(result).toEqual({
        id: 'comment123',
        name: 't1_comment123',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/comment',
        expect.stringContaining('thing_id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should submit a reply to another comment', async () => {
      const mockResponse = {
        data: {
          json: {
            data: {
              things: [
                {
                  data: {
                    id: 'reply123',
                    name: 't1_reply123',
                  },
                },
              ],
            },
          },
        },
      };

      mockClient.post.mockResolvedValue(mockResponse);

      await writeTools.submitComment({
        parent: 't1_parent_comment',
        text: 'Reply to comment',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/comment',
        expect.stringContaining('thing_id=t1_parent_comment'),
        expect.any(Object)
      );
    });
  });

  describe('editContent', () => {
    it('should edit a post', async () => {
      mockClient.post.mockResolvedValue({
        data: { json: { errors: [] } },
      });

      await writeTools.editContent('t3_post123', 'Updated content');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/editusertext',
        expect.stringContaining('thing_id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should edit a comment', async () => {
      mockClient.post.mockResolvedValue({
        data: { json: { errors: [] } },
      });

      await writeTools.editContent('t1_comment123', 'Updated comment text');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/editusertext',
        expect.stringContaining('thing_id=t1_comment123'),
        expect.any(Object)
      );
    });
  });

  describe('deleteContent', () => {
    it('should delete a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.deleteContent('t3_post123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/del',
        expect.stringContaining('id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should delete a comment', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.deleteContent('t1_comment123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/del',
        expect.stringContaining('id=t1_comment123'),
        expect.any(Object)
      );
    });
  });

  describe('vote', () => {
    it('should upvote a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.vote({
        id: 't3_post123',
        dir: 1,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/vote',
        expect.stringContaining('dir=1'),
        expect.any(Object)
      );
    });

    it('should downvote a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.vote({
        id: 't3_post123',
        dir: -1,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/vote',
        expect.stringContaining('dir=-1'),
        expect.any(Object)
      );
    });

    it('should remove vote', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.vote({
        id: 't3_post123',
        dir: 0,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/vote',
        expect.stringContaining('dir=0'),
        expect.any(Object)
      );
    });

    it('should vote on comments', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.vote({
        id: 't1_comment123',
        dir: 1,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/vote',
        expect.stringContaining('id=t1_comment123'),
        expect.any(Object)
      );
    });
  });

  describe('save and unsave', () => {
    it('should save a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.save('t3_post123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/save',
        expect.stringContaining('id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should unsave a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.unsave('t3_post123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/unsave',
        expect.stringContaining('id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should save a comment', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.save('t1_comment123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/save',
        expect.stringContaining('id=t1_comment123'),
        expect.any(Object)
      );
    });
  });

  describe('hide and unhide', () => {
    it('should hide a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.hide('t3_post123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/hide',
        expect.stringContaining('id=t3_post123'),
        expect.any(Object)
      );
    });

    it('should unhide a post', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.unhide('t3_post123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/unhide',
        expect.stringContaining('id=t3_post123'),
        expect.any(Object)
      );
    });
  });

  describe('report', () => {
    it('should report a post with reason', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.report('t3_post123', 'spam');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/report',
        expect.stringContaining('reason=spam'),
        expect.any(Object)
      );
    });

    it('should report with additional options', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.report('t3_post123', 'harassment', {
        site_reason: 'threatening',
        additional_info: 'Contains threats',
      });

      const callArgs = mockClient.post.mock.calls[0][1] as string;
      expect(callArgs).toContain('reason=harassment');
      expect(callArgs).toContain('site_reason=threatening');
      expect(callArgs).toContain('additional_info=Contains+threats');
    });

    it('should report a comment', async () => {
      mockClient.post.mockResolvedValue({ data: {} });

      await writeTools.report('t1_comment123', 'spam');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/report',
        expect.stringContaining('thing_id=t1_comment123'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors on submit', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        },
        isAxiosError: true,
      });

      await expect(
        writeTools.submitPost({
          subreddit: 'test',
          title: 'Test',
          text: 'Content',
        })
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockClient.post.mockRejectedValue(new Error('Network error'));

      await expect(
        writeTools.submitComment({
          parent: 't3_post123',
          text: 'Comment',
        })
      ).rejects.toThrow();
    });

    it('should handle image upload failures', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Image fetch failed'));

      await expect(
        writeTools.submitPost({
          subreddit: 'test',
          title: 'Image Post',
          image_url: 'https://invalid-url.com/image.jpg',
        })
      ).rejects.toThrow();
    });
  });
});
