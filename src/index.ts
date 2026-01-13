#!/usr/bin/env node

/**
 * Reddit MCP Server
 * Provides tools for reading and writing Reddit content via the Reddit API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { config } from 'dotenv';
import { RedditAuth } from './auth/reddit-auth.js';
import { RedditReadTools } from './tools/read.js';
import { RedditWriteTools } from './tools/write.js';
import { RateLimiter } from './utils/rate-limiter.js';
import { validateConfig, retryWithBackoff } from './utils/error-handler.js';
import { RedditConfig } from './types/reddit.js';

// Load environment variables
config();

// Validate configuration
validateConfig(process.env);

// Initialize configuration
const redditConfig: RedditConfig = {
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  userAgent: process.env.REDDIT_USER_AGENT!,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
  refreshToken: process.env.REDDIT_REFRESH_TOKEN,
  imgbbApiKey: process.env.IMGBB_API_KEY,
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
};

// Initialize services
const auth = new RedditAuth(redditConfig);
const rateLimiter = new RateLimiter(redditConfig.rateLimitPerMinute);

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'reddit_get_post',
    description: 'Get a Reddit post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Post ID (with or without t3_ prefix)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'reddit_get_comments',
    description: 'Get comments for a Reddit post',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'Post ID (with or without t3_ prefix)',
        },
        sort: {
          type: 'string',
          enum: ['confidence', 'top', 'new', 'controversial', 'old', 'qa'],
          description: 'How to sort comments',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of comments to retrieve',
        },
        depth: {
          type: 'number',
          description: 'Maximum depth of comment tree',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'reddit_search_posts',
    description: 'Search for Reddit posts',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        subreddit: {
          type: 'string',
          description: 'Subreddit to search in (optional)',
        },
        sort: {
          type: 'string',
          enum: ['relevance', 'hot', 'top', 'new', 'comments'],
          description: 'How to sort results',
        },
        time: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month', 'year', 'all'],
          description: 'Time range for results',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'reddit_get_subreddit_posts',
    description: 'Get posts from a subreddit',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: {
          type: 'string',
          description: 'Subreddit name',
        },
        sort: {
          type: 'string',
          enum: ['hot', 'new', 'rising', 'top', 'controversial'],
          description: 'How to sort posts',
        },
        time: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month', 'year', 'all'],
          description: 'Time range for results',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts',
        },
      },
      required: ['subreddit'],
    },
  },
  {
    name: 'reddit_get_subreddit_info',
    description: 'Get information about a subreddit',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: {
          type: 'string',
          description: 'Subreddit name',
        },
      },
      required: ['subreddit'],
    },
  },
  {
    name: 'reddit_get_user_content',
    description: "Get a user's posts and comments",
    inputSchema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Reddit username',
        },
        type: {
          type: 'string',
          enum: ['submitted', 'comments', 'overview'],
          description: 'Type of content to retrieve',
        },
        sort: {
          type: 'string',
          enum: ['hot', 'new', 'top', 'controversial'],
          description: 'How to sort content',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items',
        },
      },
      required: ['username'],
    },
  },
  {
    name: 'reddit_submit_post',
    description: 'Submit a new post to a subreddit (text, link, or image). For images, provide either image_url (remote) or image_data (base64 encoded local file)',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: {
          type: 'string',
          description: 'Subreddit name',
        },
        title: {
          type: 'string',
          description: 'Post title',
        },
        text: {
          type: 'string',
          description: 'Post text content (for self posts)',
        },
        url: {
          type: 'string',
          description: 'URL to link to (for link posts)',
        },
        image_url: {
          type: 'string',
          description: 'URL to an image to download and post (for remote images)',
        },
        image_data: {
          type: 'string',
          description: 'Base64 encoded image data (for local files). Will be uploaded to free hosting service (Catbox.moe or ImgBB) then posted to Reddit',
        },
        image_filename: {
          type: 'string',
          description: 'Original filename with extension (required when using image_data). Example: photo.jpg',
        },
        nsfw: {
          type: 'boolean',
          description: 'Mark as NSFW',
        },
        spoiler: {
          type: 'boolean',
          description: 'Mark as spoiler',
        },
      },
      required: ['subreddit', 'title'],
    },
  },
  {
    name: 'reddit_submit_comment',
    description: 'Submit a comment on a post or reply to another comment',
    inputSchema: {
      type: 'object',
      properties: {
        parent: {
          type: 'string',
          description: 'Parent ID (post or comment fullname with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
        text: {
          type: 'string',
          description: 'Comment text',
        },
      },
      required: ['parent', 'text'],
    },
  },
  {
    name: 'reddit_edit_content',
    description: 'Edit a post or comment',
    inputSchema: {
      type: 'object',
      properties: {
        thingId: {
          type: 'string',
          description: 'Thing ID (with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
        text: {
          type: 'string',
          description: 'New text content',
        },
      },
      required: ['thingId', 'text'],
    },
  },
  {
    name: 'reddit_delete_content',
    description: 'Delete a post or comment',
    inputSchema: {
      type: 'object',
      properties: {
        thingId: {
          type: 'string',
          description: 'Thing ID (with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
      },
      required: ['thingId'],
    },
  },
  {
    name: 'reddit_vote',
    description: 'Vote on a post or comment',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Thing ID (with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
        direction: {
          type: 'number',
          enum: [-1, 0, 1],
          description: '1 = upvote, 0 = remove vote, -1 = downvote',
        },
      },
      required: ['id', 'direction'],
    },
  },
  {
    name: 'reddit_save',
    description: 'Save a post or comment',
    inputSchema: {
      type: 'object',
      properties: {
        thingId: {
          type: 'string',
          description: 'Thing ID (with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
      },
      required: ['thingId'],
    },
  },
  {
    name: 'reddit_unsave',
    description: 'Unsave a post or comment',
    inputSchema: {
      type: 'object',
      properties: {
        thingId: {
          type: 'string',
          description: 'Thing ID (with prefix, e.g., t3_xxxxx or t1_xxxxx)',
        },
      },
      required: ['thingId'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'reddit-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: No arguments provided',
        },
      ],
      isError: true,
    };
  }

  try {
    // Apply rate limiting
    await rateLimiter.acquire();

    // Get authenticated client with retry
    const client = await retryWithBackoff(
      () => auth.createAuthenticatedClient(),
      redditConfig.maxRetries
    );

    const readTools = new RedditReadTools(client);
    const writeTools = new RedditWriteTools(client, redditConfig.imgbbApiKey);

    // Execute the requested tool
    let result: any;

    switch (name) {
      case 'reddit_get_post':
        result = await readTools.getPost(args.id as string);
        break;

      case 'reddit_get_comments':
        result = await readTools.getComments(args.postId as string, {
          sort: args.sort as any,
          limit: args.limit as number,
          depth: args.depth as number,
        });
        break;

      case 'reddit_search_posts':
        result = await readTools.searchPosts({
          query: args.query as string,
          subreddit: args.subreddit as string,
          sort: args.sort as any,
          time: args.time as any,
          limit: args.limit as number,
        });
        break;

      case 'reddit_get_subreddit_posts':
        result = await readTools.getSubredditPosts(args.subreddit as string, {
          sort: args.sort as any,
          time: args.time as any,
          limit: args.limit as number,
        });
        break;

      case 'reddit_get_subreddit_info':
        result = await readTools.getSubreddit(args.subreddit as string);
        break;

      case 'reddit_get_user_content':
        result = await readTools.getUserContent(args.username as string, {
          type: args.type as any,
          sort: args.sort as any,
          limit: args.limit as number,
        });
        break;

      case 'reddit_submit_post':
        result = await writeTools.submitPost({
          subreddit: args.subreddit as string,
          title: args.title as string,
          text: args.text as string,
          url: args.url as string,
          image_url: args.image_url as string,
          image_data: args.image_data as string,
          image_filename: args.image_filename as string,
          nsfw: args.nsfw as boolean,
          spoiler: args.spoiler as boolean,
        });
        break;

      case 'reddit_submit_comment':
        result = await writeTools.submitComment({
          parent: args.parent as string,
          text: args.text as string,
        });
        break;

      case 'reddit_edit_content':
        await writeTools.editContent(args.thingId as string, args.text as string);
        result = { success: true, message: 'Content edited successfully' };
        break;

      case 'reddit_delete_content':
        await writeTools.deleteContent(args.thingId as string);
        result = { success: true, message: 'Content deleted successfully' };
        break;

      case 'reddit_vote':
        await writeTools.vote({
          id: args.id as string,
          dir: args.direction as -1 | 0 | 1,
        });
        result = { success: true, message: 'Vote recorded successfully' };
        break;

      case 'reddit_save':
        await writeTools.save(args.thingId as string);
        result = { success: true, message: 'Content saved successfully' };
        break;

      case 'reddit_unsave':
        await writeTools.unsave(args.thingId as string);
        result = { success: true, message: 'Content unsaved successfully' };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  
  if (transport === 'sse') {
    // SSE transport for HTTP/network access
    const app = express();

    // Add CORS headers for n8n communication
    app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Max-Age', '86400');
      next();
    });

    app.use(express.json({ limit: '10mb' }));
    app.use(express.text({ type: '*/*', limit: '10mb' }));
    const PORT = parseInt(process.env.PORT || '3000', 10);
    
    // Create ONE server instance that we reuse
    console.error('Initializing MCP Server for SSE...');
    
    // Store active SSE transports by session ID
    const activeTransports = new Map<string, any>();
    
    app.get('/sse', async (_req, res) => {
      console.error('📡 New SSE connection established');

      // Create SSE transport for this connection
      // The SDK automatically generates a session ID that we can access
      const sseTransport = new SSEServerTransport('/message', res);

      // Access the session ID from the transport (it's a private property but accessible)
      const sessionId = (sseTransport as any)._sessionId;
      console.error(`📍 Session ID: ${sessionId}`);

      // Store transport BEFORE connecting
      activeTransports.set(sessionId, sseTransport);
      console.error(`💾 Stored transport in activeTransports`);

      // Connect server to this transport
      try {
        await server.connect(sseTransport);
        console.error('✅ Server connected to SSE transport');
      } catch (error) {
        console.error('❌ Error connecting server:', error);
        activeTransports.delete(sessionId);
        return;
      }

      // Clean up on close
      res.on('close', () => {
        console.error(`🔌 SSE connection closed - Session: ${sessionId}`);
        activeTransports.delete(sessionId);
      });
    });
    
    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      console.error(`📨 Received message - Session ID: ${sessionId || 'MISSING'}`);
      console.error(`   Request URL: ${req.url}`);
      console.error(`   Query params:`, req.query);
      console.error(`   Message: ${body.substring(0, 200)}`);
      console.error(`📊 Active sessions: [${Array.from(activeTransports.keys()).join(', ')}]`);

      // If no session ID in query, try to find the most recent transport (fallback)
      let transport = sessionId ? activeTransports.get(sessionId) : null;

      if (!transport && activeTransports.size === 1) {
        // If there's only one active session and no sessionId provided, use it
        const [firstTransport] = Array.from(activeTransports.values());
        transport = firstTransport;
        console.error(`⚡ Using fallback: single active transport (no sessionId in request)`);
      }

      if (transport && typeof transport.handlePostMessage === 'function') {
        console.error(`🔄 Processing message with transport`);
        try {
          // Pass the already-parsed body as the third parameter to avoid stream reading
          const parsedBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          await transport.handlePostMessage(req, res, parsedBody);
          console.error(`✅ Message processed successfully`);
          return;
        } catch (error) {
          console.error(`❌ Error processing message:`, error);
          if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal server error', details: String(error) });
          }
          return;
        }
      } else {
        console.error(`⚠️ No transport found - sessionId: ${sessionId}, activeCount: ${activeTransports.size}`);
        if (!res.headersSent) {
          return res.status(404).json({
            error: 'No active MCP session',
            providedSessionId: sessionId || null,
            activeSessions: Array.from(activeTransports.keys()),
            hint: 'Client must first establish SSE connection to /sse endpoint'
          });
        }
        return;
      }
    });
    
    app.listen(PORT, '0.0.0.0', () => {
      console.error(`✅ Reddit MCP Server listening on port ${PORT}`);
      console.error(`📍 SSE Endpoint: http://localhost:${PORT}/sse`);
    });
  } else {
    // Default: stdio transport
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('Reddit MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
