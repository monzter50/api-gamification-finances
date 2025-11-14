# Logout Implementation with MongoDB Token Blacklisting

This document explains how the logout functionality works in the API, including the MongoDB collection for token blacklisting.

## Overview

The logout system uses a **token blacklisting approach** where revoked tokens are stored in a MongoDB collection. This provides:

- ✅ **Security**: Prevents reuse of logged-out tokens
- ✅ **Scalability**: Works across multiple server instances
- ✅ **Persistence**: Survives server restarts
- ✅ **Automatic cleanup**: Expired tokens are automatically removed

## Database Collection

### BlacklistedToken Model

```typescript
interface IBlacklistedToken {
  token: string;        // The JWT token to blacklist
  userId: string;       // User ID for tracking
  expiresAt: Date;      // Token expiration (for TTL cleanup)
  createdAt: Date;      // When the token was blacklisted
}
```

### Key Features

1. **TTL Index**: Automatically deletes expired tokens
2. **Unique Index**: Prevents duplicate blacklisted tokens
3. **Compound Index**: Optimizes queries by token and user

## API Endpoints

### POST `/api/auth/logout`

**Authentication Required**: Yes (Bearer token)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Error Responses**:
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

## How It Works

### 1. Client-Side Logout Flow

```javascript
// Frontend logout function
async function logout() {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      // Remove token from storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
```

### 2. Server-Side Process

1. **Authentication Check**: Verifies the JWT token is valid
2. **Token Blacklisting**: Adds the token to the `blacklisted_tokens` collection
3. **Response**: Returns success message to client

### 3. Token Validation

When any protected endpoint is accessed:

1. **Extract Token**: Gets token from Authorization header
2. **Check Blacklist**: Queries MongoDB for token in blacklist
3. **Verify JWT**: Validates token signature and expiration
4. **Allow/Deny**: Grants or denies access accordingly

## Testing

### Using cURL

```bash
# 1. Login to get a token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Use the token to logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# 3. Try to use the same token (should fail)
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using the Test Script

```bash
# Run the test script
npm run ts-node src/scripts/testLogout.ts
```

## Database Queries

### Check if Token is Blacklisted

```javascript
const isBlacklisted = await BlacklistedToken.exists({ token: 'your_jwt_token' });
```

### Add Token to Blacklist

```javascript
await BlacklistedToken.create({
  token: 'your_jwt_token',
  userId: 'user_id',
  expiresAt: new Date('2024-12-31')
});
```

### Clean Expired Tokens

```javascript
const result = await BlacklistedToken.deleteMany({
  expiresAt: { $lt: new Date() }
});
```

## Security Considerations

### 1. Token Expiration

- Tokens have built-in expiration (JWT `exp` claim)
- TTL index automatically removes expired tokens
- Manual cleanup available for immediate removal

### 2. Storage Optimization

- Only blacklisted tokens are stored
- Automatic cleanup prevents database bloat
- Indexes optimize query performance

### 3. Scalability

- Works across multiple server instances
- No shared memory dependencies
- MongoDB handles concurrent access

## Monitoring

### Database Metrics

Monitor the `blacklisted_tokens` collection:

```javascript
// Count blacklisted tokens
const count = await BlacklistedToken.countDocuments();

// Check collection size
const stats = await BlacklistedToken.collection.stats();
```

### Logging

The logout process logs:

```javascript
console.log(`User ${req.user?.email} logged out`);
```

## Troubleshooting

### Common Issues

1. **Token Still Works After Logout**
   - Check if token is actually in blacklist
   - Verify authentication middleware is checking blacklist

2. **Database Connection Issues**
   - Ensure MongoDB is running
   - Check connection string in environment variables

3. **Performance Issues**
   - Monitor index usage
   - Consider Redis for high-traffic applications

### Debug Commands

```javascript
// Check if token exists in blacklist
const exists = await BlacklistedToken.exists({ token: 'your_token' });
console.log('Token blacklisted:', exists);

// List all blacklisted tokens
const tokens = await BlacklistedToken.find({}).limit(10);
console.log('Blacklisted tokens:', tokens);
```

## Production Recommendations

1. **Use Redis** for high-traffic applications
2. **Monitor** blacklist collection size
3. **Set up alerts** for unusual logout patterns
4. **Regular cleanup** of old blacklisted tokens
5. **Logging** for security audit trails

## Migration from In-Memory

If migrating from an in-memory blacklist:

1. Export existing blacklisted tokens
2. Import into MongoDB collection
3. Update authentication middleware
4. Test thoroughly before deployment 