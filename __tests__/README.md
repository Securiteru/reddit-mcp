# Reddit MCP Server Test Suite

Comprehensive test suite for the Reddit MCP server with unit and integration tests.

## Test Structure

```
__tests__/
├── unit/              # Unit tests for individual components
│   ├── utils/         # Utility function tests
│   │   ├── rate-limiter.test.ts  # Rate limiting logic (✅ 17 tests passing)
│   │   └── error-handler.test.ts # Error parsing and retry logic
│   ├── auth/          # Authentication tests
│   │   └── reddit-auth.test.ts   # OAuth2 authentication (✅ 21 tests passing)
│   └── tools/         # Tool-specific tests
├── integration/       # Integration tests
│   ├── read-tools.test.ts        # Read operations (posts, comments, search)
│   └── write-tools.test.ts       # Write operations (submit, edit, delete, vote)
├── helpers/           # Test utilities
│   └── mock-data.ts              # Mock data factories for tests
├── setup.ts           # Jest setup and environment configuration
└── README.md          # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suite
```bash
npm test -- --testPathPattern="rate-limiter"
npm test -- --testPathPattern="auth"
npm test -- --testPathPattern="read-tools"
npm test -- --testPathPattern="write-tools"
```

### Run with coverage
```bash
npm test -- --coverage
```

### Watch mode
```bash
npm run test:watch
```

## Test Coverage

### Unit Tests

#### Rate Limiter (`rate-limiter.test.ts`)
- ✅ Token bucket initialization with custom rates
- ✅ Token acquisition and consumption
- ✅ Request queueing when rate limit exceeded
- ✅ Token refilling over time
- ✅ Status reporting
- ✅ Reset functionality
- ✅ Concurrent request handling
- ✅ Edge cases (zero tokens, rapid requests)

#### Error Handler (`error-handler.test.ts`)
- Error class creation (RedditAPIError, RateLimitError, AuthenticationError, etc.)
- Error parsing from Axios responses (401, 403, 404, 429, 500, etc.)
- Retry logic with exponential backoff
- Retry-after header respect for rate limiting
- Non-retryable error detection
- Configuration validation

#### Reddit Auth (`reddit-auth.test.ts`)
- ✅ OAuth2 initialization
- ✅ Password-based authentication
- ✅ Refresh token authentication
- ✅ Token expiry and refresh handling
- ✅ Authenticated client creation
- ✅ Token revocation
- ✅ Error handling for authentication failures

### Integration Tests

#### Read Tools (`read-tools.test.ts`)
- Post retrieval by ID
- Comment fetching with sorting and depth
- Post searching with filters
- Subreddit post listing
- Subreddit information retrieval
- User content fetching
- Saved items retrieval
- Current user info (`/me` endpoint)
- Error handling for API failures

#### Write Tools (`write-tools.test.ts`)
- Text post submission
- Link post submission
- Image post submission with upload
- Comment submission and replies
- Content editing (posts and comments)
- Content deletion
- Voting (upvote, downvote, remove vote)
- Save/unsave functionality
- Hide/unhide posts
- Content reporting
- Error handling for write operations

## Mock Data Helpers

The `helpers/mock-data.ts` file provides factory functions for creating test data:

```typescript
// Create mock Reddit post
const post = createMockPost({ title: 'Custom Title' });

// Create mock post listing
const listing = createMockPostListing([post1, post2]);

// Create mock comment
const comment = createMockComment({ body: 'Test comment' });

// Create mock comment listing
const commentListing = createMockCommentListing([comment1, comment2]);
```

## Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support with ts-jest
- ESM module support
- Code coverage thresholds:
  - Branches: 70%
  - Functions: 80%
  - Lines: 80%
  - Statements: 80%

### Test Environment (`setup.ts`)
- Environment variables for testing
- Test timeout configuration (10s)
- Console.error suppression for expected errors

## Testing Best Practices

### Unit Tests
1. **Mock external dependencies**: Use Jest mocks for axios, API clients
2. **Test edge cases**: Zero values, null, undefined, boundary conditions
3. **Fake timers**: Use `jest.useFakeTimers()` for time-dependent tests
4. **Clear mocks**: Always clear mocks in `beforeEach()`

### Integration Tests
1. **Mock HTTP layer**: Mock axios responses, not internal implementations
2. **Test happy paths and error cases**: Both successful operations and failures
3. **Verify API calls**: Check correct endpoints, params, headers
4. **Use factory functions**: Leverage mock-data.ts for consistent test data

### Test Structure
```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Initialize mocks
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange: Set up test data and mocks
      // Act: Execute the method
      // Assert: Verify expected behavior
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

## Debugging Tests

### Enable verbose output
```bash
npm test -- --verbose
```

### Run single test
```bash
npm test -- --testNamePattern="should fetch post by ID"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "${fileBasenameNoExtension}",
    "--config",
    "jest.config.js"
  ],
  "console": "integratedTerminal"
}
```

## Known Issues

- Some tests using fake timers may timeout if async operations aren't properly awaited
- Image upload tests require mocking both external HTTP calls and FormData operations
- Reddit API response structures must include all required fields (`dist`, `modhash`, etc.)

## Contributing

When adding new tests:
1. Follow existing test structure and naming conventions
2. Use mock-data.ts factories for consistency
3. Add both success and error test cases
4. Update this README with new test coverage
5. Ensure tests pass locally before committing
