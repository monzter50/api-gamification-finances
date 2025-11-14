# MongoDB Atlas Setup Guide

This guide explains how to connect your gamification-finances API to MongoDB Atlas using SRV connection strings.

## Prerequisites

1. MongoDB Atlas account
2. A MongoDB Atlas cluster created
3. Database user with appropriate permissions
4. Network access configured (IP whitelist or 0.0.0.0/0 for development)

## Step 1: Get Your MongoDB Atlas Connection String

1. **Log into MongoDB Atlas**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Sign in to your account

2. **Navigate to Your Cluster**
   - Click on your cluster name
   - Click "Connect" button

3. **Choose Connection Method**
   - Select "Connect your application"
   - Choose "Node.js" as your driver
   - Select the appropriate version (4.1 or later)

4. **Copy the Connection String**
   - You'll see a connection string like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 2: Configure Your Environment Variables

Create a `.env` file in your project root and add your MongoDB Atlas connection strings:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Atlas Configuration
# Replace the placeholders with your actual values
MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/gamification-finances?retryWrites=true&w=majority

# Environment-specific databases
MONGODB_URI_DEV=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/gamification-finances-dev?retryWrites=true&w=majority
MONGODB_URI_TEST=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/gamification-finances-test?retryWrites=true&w=majority
MONGODB_URI_PROD=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/gamification-finances?retryWrites=true&w=majority

# Other configurations...
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

## Step 3: Connection String Breakdown

Your MongoDB Atlas SRV connection string has these components:

```
mongodb+srv://username:password@cluster-url/database-name?options
```

### Components:
- **`mongodb+srv://`** - Protocol for MongoDB Atlas
- **`username`** - Your MongoDB Atlas database user
- **`password`** - Your MongoDB Atlas database password
- **`cluster-url`** - Your cluster's unique URL (e.g., `cluster0.xxxxx.mongodb.net`)
- **`database-name`** - The specific database name (e.g., `gamification-finances-dev`)
- **`options`** - Connection options like `retryWrites=true&w=majority`

## Step 4: Database Names for Different Environments

Based on your configuration, you'll have these databases:

- **Development**: `gamification-finances-dev`
- **Test**: `gamification-finances-test`
- **Production**: `gamification-finances`

## Step 5: Test Your Connection

Run your application to test the connection:

```bash
npm run dev
# or
yarn dev
```

You should see output like:
```
📦 MongoDB conectado: cluster0.xxxxx.mongodb.net
🗄️  Base de datos: gamification-finances-dev
🚀 Servidor corriendo en puerto 3000
```

## Step 6: Create Database User (if needed)

If you haven't created a database user yet:

1. **In MongoDB Atlas:**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Set username and password
   - Select "Read and write to any database" for development
   - Click "Add User"

2. **Network Access:**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For development: Add `0.0.0.0/0` (allows all IPs)
   - For production: Add specific IP addresses

## Step 7: Security Best Practices

### For Development:
```bash
# Allow all IPs (not recommended for production)
MONGODB_URI_DEV=mongodb+srv://username:password@cluster-url/gamification-finances-dev?retryWrites=true&w=majority
```

### For Production:
```bash
# Use specific IP addresses and stronger authentication
MONGODB_URI_PROD=mongodb+srv://username:password@cluster-url/gamification-finances?retryWrites=true&w=majority&authSource=admin
```

## Troubleshooting

### Common Issues:

1. **Authentication Failed**
   - Check username and password
   - Ensure database user has correct permissions

2. **Network Access Denied**
   - Add your IP address to MongoDB Atlas Network Access
   - For development, you can temporarily allow all IPs (0.0.0.0/0)

3. **Connection Timeout**
   - Check your internet connection
   - Verify the cluster URL is correct
   - Ensure the cluster is running

4. **Database Not Found**
   - MongoDB Atlas creates databases automatically when you first insert data
   - The database will be created when your application first connects and saves data

## Example Connection Test

You can test your connection using the utility functions:

```typescript
import { connectToDevDB, getDatabaseInfo } from './src/utils/databaseUtils';

// Test connection
await connectToDevDB();
getDatabaseInfo();
```

This should output:
```
✅ Conectado a base de datos de desarrollo: gamification-finances-dev
📊 Base de datos actual: gamification-finances-dev
``` 