/**
 * Reddit API type definitions
 */

export interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  rateLimitPerMinute: number;
  maxRetries: number;
}

export interface RedditAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export interface RedditPost {
  id: string;
  name: string;
  title: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  selftext: string;
  url: string;
  permalink: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
  is_video: boolean;
  link_flair_text?: string;
  stickied: boolean;
  locked: boolean;
  over_18: boolean;
}

export interface RedditComment {
  id: string;
  name: string;
  author: string;
  body: string;
  body_html: string;
  score: number;
  created_utc: number;
  permalink: string;
  parent_id: string;
  link_id: string;
  subreddit: string;
  depth: number;
  replies?: RedditCommentListing;
  stickied: boolean;
  is_submitter: boolean;
}

export interface RedditListing<T> {
  kind: string;
  data: {
    after: string | null;
    before: string | null;
    dist: number;
    modhash: string;
    children: Array<{
      kind: string;
      data: T;
    }>;
  };
}

export type RedditPostListing = RedditListing<RedditPost>;
export type RedditCommentListing = RedditListing<RedditComment>;

export interface RedditSubreddit {
  id: string;
  name: string;
  display_name: string;
  display_name_prefixed: string;
  title: string;
  public_description: string;
  description: string;
  subscribers: number;
  active_user_count: number;
  created_utc: number;
  over18: boolean;
  url: string;
  icon_img: string;
  banner_img: string;
}

export interface RedditUser {
  id: string;
  name: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  is_gold: boolean;
  is_mod: boolean;
  verified: boolean;
  icon_img: string;
}

export interface SubmitPostParams {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  image_url?: string; // URL to an image to upload and post
  flair_id?: string;
  nsfw?: boolean;
  spoiler?: boolean;
  send_replies?: boolean;
}

export interface RedditMediaAsset {
  asset_id: string;
  processing_state: string;
  payload: {
    filepath: string;
  };
  websocket_url: string;
}

export interface RedditMediaUploadLease {
  asset: RedditMediaAsset;
  upload_lease: {
    action: string;
    fields: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface SubmitCommentParams {
  parent: string; // thing_id (post or comment ID with prefix)
  text: string;
}

export interface VoteParams {
  id: string; // thing_id
  dir: -1 | 0 | 1; // -1 = downvote, 0 = unvote, 1 = upvote
}

export interface SearchParams {
  query: string;
  subreddit?: string;
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  after?: string;
}

export interface RedditError {
  message: string;
  error: number;
}

export interface RateLimitInfo {
  remaining: number;
  used: number;
  reset: number;
}
