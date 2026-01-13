/**
 * Helper functions for creating mock Reddit API data
 */

import {
  RedditPost,
  RedditComment,
  RedditPostListing,
  RedditCommentListing,
} from '../../src/types/reddit';

export function createMockPostListing(
  posts: RedditPost[],
  options: { after?: string | null; before?: string | null } = {}
): RedditPostListing {
  return {
    kind: 'Listing',
    data: {
      children: posts.map((post) => ({ kind: 't3', data: post })),
      after: options.after ?? null,
      before: options.before ?? null,
      dist: posts.length,
      modhash: '',
    },
  };
}

export function createMockCommentListing(
  comments: RedditComment[],
  options: { after?: string | null; before?: string | null } = {}
): RedditCommentListing {
  return {
    kind: 'Listing',
    data: {
      children: comments.map((comment) => ({ kind: 't1', data: comment })),
      after: options.after ?? null,
      before: options.before ?? null,
      dist: comments.length,
      modhash: '',
    },
  };
}

export function createMockPost(overrides: Partial<RedditPost> = {}): RedditPost {
  return {
    id: 'abc123',
    name: 't3_abc123',
    title: 'Test Post',
    author: 'testuser',
    subreddit: 'test',
    subreddit_name_prefixed: 'r/test',
    selftext: 'Test content',
    url: 'https://reddit.com/r/test/comments/abc123',
    permalink: '/r/test/comments/abc123/test_post',
    score: 100,
    upvote_ratio: 0.95,
    num_comments: 10,
    created_utc: 1234567890,
    is_self: true,
    is_video: false,
    stickied: false,
    locked: false,
    over_18: false,
    ...overrides,
  };
}

export function createMockComment(overrides: Partial<RedditComment> = {}): RedditComment {
  return {
    id: 'comment123',
    name: 't1_comment123',
    author: 'commenter',
    body: 'Test comment',
    body_html: '<div>Test comment</div>',
    score: 5,
    created_utc: 1234567890,
    permalink: '/r/test/comments/abc123/_/comment123',
    parent_id: 't3_abc123',
    link_id: 't3_abc123',
    subreddit: 'test',
    depth: 0,
    stickied: false,
    is_submitter: false,
    ...overrides,
  };
}
