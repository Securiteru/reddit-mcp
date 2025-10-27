# Reddit MCP Server

A Model Context Protocol (MCP) server that enables Claude to interact with Reddit through the official API. Read and write posts, comments, and images with full OAuth2 authentication.

## Features

### 📖 Reading Tools (6)
- **reddit_get_post** - Fetch post by ID with full details
- **reddit_get_comments** - Get nested comment threads with replies
- **reddit_search_posts** - Search across Reddit or within specific subreddits
- **reddit_get_subreddit_posts** - Get hot/new/top posts from any subreddit
- **reddit_get_subreddit_info** - Fetch subreddit details and statistics
- **reddit_get_user_content** - Get user's posts and comments

### ✍️ Writing Tools (7)
- **reddit_submit_post** - Create text, link, or image posts (with local file upload!)
- **reddit_submit_comment** - Reply to posts or other comments
- **reddit_edit_content** - Edit your posts and comments
- **reddit_delete_content** - Delete your content
- **reddit_vote** - Upvote, downvote, or remove votes
- **reddit_save** - Save posts and comments
- **reddit_unsave** - Unsave content

### 🖼️ Image Upload Support
- **Upload local images**: Provide base64 encoded images directly
- **Free hosting**: Uses Catbox.moe (permissionless) or ImgBB (free API key)
- **Automatic workflow**: Local file → Hosting → Reddit post
- **Supported formats**: JPG, PNG, GIF, WebP

## Quick Start

### 1. Create Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..."
3. Choose **"script"** type
4. Set redirect URI: `http://localhost:8080` (required but unused)
5. Save your Client ID and Secret

**Important**: Your Reddit account must have 2FA **disabled** for password grant OAuth.

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Reddit API Credentials
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
REDDIT_USER_AGENT=mcp:reddit-mcp:1.0.0 (by /u/your_username)

# Optional: ImgBB API key for image hosting fallback
# If not provided, will use Catbox.moe (permissionless, free)
# Get free API key at: https://api.imgbb.com/
IMGBB_API_KEY=
```

### 3. Install & Build

```bash
npm install
npm run build
```

### 4. Run Server

```bash
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t reddit-mcp:latest .
```

### Run Container

```bash
docker run --rm \
  -e REDDIT_CLIENT_ID=your_client_id \
  -e REDDIT_CLIENT_SECRET=your_secret \
  -e REDDIT_USERNAME=your_username \
  -e REDDIT_PASSWORD=your_password \
  -e REDDIT_USER_AGENT="mcp:reddit-mcp:1.0.0 (by /u/your_username)" \
  reddit-mcp:latest
```

### Docker MCP Gateway

This server is designed to work with [Docker MCP Gateway](https://docs.docker.com/desktop/features/mcp/). Configuration is available in `reddit-mcp-catalog.yaml`.

## Usage Examples

### Reading from Reddit

**Get top posts from a subreddit:**
```json
{
  "tool": "reddit_get_subreddit_posts",
  "arguments": {
    "subreddit": "programming",
    "sort": "top",
    "time": "week",
    "limit": 10
  }
}
```

**Search Reddit:**
```json
{
  "tool": "reddit_search_posts",
  "arguments": {
    "query": "machine learning",
    "sort": "relevance",
    "time": "month",
    "limit": 25
  }
}
```

### Writing to Reddit

**Create a text post:**
```json
{
  "tool": "reddit_submit_post",
  "arguments": {
    "subreddit": "test",
    "title": "Hello from Reddit MCP!",
    "text": "This is a test post created via the MCP server.",
    "nsfw": false,
    "spoiler": false
  }
}
```

**Create a link post:**
```json
{
  "tool": "reddit_submit_post",
  "arguments": {
    "subreddit": "technology",
    "title": "Interesting Article",
    "url": "https://example.com/article",
    "nsfw": false
  }
}
```

**Create an image post (from URL):**
```json
{
  "tool": "reddit_submit_post",
  "arguments": {
    "subreddit": "pics",
    "title": "Check out this image!",
    "image_url": "https://example.com/image.jpg",
    "nsfw": false
  }
}
```

**Create an image post (from local file):**
```json
{
  "tool": "reddit_submit_post",
  "arguments": {
    "subreddit": "pics",
    "title": "My photo",
    "image_data": "iVBORw0KGgoAAAANS...base64data...CYII=",
    "image_filename": "photo.jpg",
    "nsfw": false
  }
}
```

**Post a comment:**
```json
{
  "tool": "reddit_submit_comment",
  "arguments": {
    "parent": "t3_abc123",
    "text": "Great post! Here's my comment."
  }
}
```

### Voting & Saving

**Upvote a post:**
```json
{
  "tool": "reddit_vote",
  "arguments": {
    "id": "t3_abc123",
    "dir": 1
  }
}
```

**Save a post:**
```json
{
  "tool": "reddit_save",
  "arguments": {
    "id": "t3_abc123"
  }
}
```

## Image Upload Workflow

The server supports uploading local images to Reddit through a seamless E2E workflow:

1. **Client provides base64 image**: Claude sends the image data encoded as base64
2. **Upload to free hosting**: Server uploads to Catbox.moe (or ImgBB with API key)
3. **Get public URL**: Hosting service returns a permanent URL
4. **Create Reddit post**: Server creates a link post with the hosted image

### Hosting Services

**Primary: Catbox.moe**
- ✅ Completely free
- ✅ No API key required
- ✅ No registration needed
- ✅ Permanent file hosting
- ✅ No rate limits for reasonable use

**Fallback: ImgBB**
- ✅ Free tier available
- ✅ Requires API key (free at https://api.imgbb.com/)
- ✅ Generous limits
- ✅ High reliability

### Supported Image Formats
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)

## Rate Limiting

The server implements token bucket rate limiting:
- **Default**: 60 requests per minute
- **Configurable**: Set `RATE_LIMIT_PER_MINUTE` in `.env`
- **Automatic queuing**: Requests wait for available tokens
- **Reddit compliant**: Respects Reddit's API guidelines

## Error Handling

- **Automatic retry**: Failed requests retry with exponential backoff
- **Token refresh**: OAuth tokens automatically refreshed when expired
- **Rate limit detection**: Server detects and handles 429 responses
- **Detailed errors**: Clear error messages for troubleshooting

## Security

- ✅ OAuth2 authentication with Reddit
- ✅ Credentials via environment variables
- ✅ No secrets in code or Docker images
- ✅ Container isolation
- ✅ Secure token management

## Project Structure

```
reddit-mcp/
├── src/
│   ├── auth/
│   │   └── reddit-auth.ts        # OAuth2 authentication
│   ├── tools/
│   │   ├── read.ts               # Reading operations
│   │   └── write.ts              # Writing operations
│   ├── utils/
│   │   ├── rate-limiter.ts       # Token bucket rate limiting
│   │   ├── error-handler.ts      # Error handling & retry
│   │   └── image-upload.ts       # Image hosting integration
│   ├── types/
│   │   └── reddit.ts             # TypeScript definitions
│   └── index.ts                  # MCP server entry point
├── dist/                          # Compiled JavaScript
├── Dockerfile                     # Container definition
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── .env.example                   # Environment template
└── tools.json                     # Tool definitions for MCP registry
```

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Test

```bash
# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env

# Test reading from Reddit
npx tsx test-mcp-subreddit.ts

# Test posting with images
npx tsx post-scenester.ts
```

## Troubleshooting

### Authentication Errors

**Error: `invalid_grant`**
- Ensure 2FA is **disabled** on your Reddit account
- Verify username and password are correct
- Check that app type is **"script"** not "web app"

**Error: `403 Forbidden`**
- Check your user agent format matches: `platform:app_id:version (by /u/username)`
- Ensure credentials are correct
- Wait 10-15 minutes if rate limited

### Image Upload Issues

**Upload fails with timeout:**
- Check your internet connection
- Try again - free services can have temporary issues
- If using ImgBB, verify your API key

**Image too large:**
- Reddit has size limits for posts
- Consider resizing images before upload
- Most hosting services limit file sizes

## API Reference

### Tool: reddit_submit_post

Submit a new post to a subreddit (text, link, or image).

**Parameters:**
- `subreddit` (string, required): Subreddit name
- `title` (string, required): Post title
- `text` (string, optional): Post body text (for text posts)
- `url` (string, optional): URL to link (for link posts)
- `image_url` (string, optional): URL to download and post (for remote images)
- `image_data` (string, optional): Base64 encoded image data (for local files)
- `image_filename` (string, optional): Filename with extension (required with image_data)
- `nsfw` (boolean, optional): Mark as NSFW
- `spoiler` (boolean, optional): Mark as spoiler

**Returns:**
```json
{
  "id": "abc123",
  "name": "t3_abc123",
  "url": "https://www.reddit.com/r/test/comments/abc123/..."
}
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! This server is part of the [Docker MCP Registry](https://github.com/docker/mcp-registry).

## Support

- **Reddit API Status**: https://www.redditstatus.com/
- **Reddit API Docs**: https://www.reddit.com/dev/api
- **MCP Protocol**: https://modelcontextprotocol.io/
- **Docker MCP Gateway**: https://docs.docker.com/desktop/features/mcp/

## Changelog

### v1.2.0 (Latest)
- ✨ Added local file image upload support
- ✨ Integrated free image hosting (Catbox.moe, ImgBB)
- ✨ Base64 image data support for MCP
- 🐛 Simplified image posting (link posts vs media API)
- 📝 Updated documentation

### v1.1.0
- ✨ Added image URL upload support
- 🐛 Fixed authentication issues
- 📝 Improved error messages

### v1.0.0
- 🎉 Initial release
- ✅ 13 tools for Reddit interaction
- ✅ OAuth2 authentication
- ✅ Rate limiting
- ✅ Docker support
