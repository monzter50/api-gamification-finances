import { connectDB } from '../config/database';
import { User } from '../models/User';
import { BlacklistedToken } from '../models/BlacklistedToken';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default_secret';

async function testLogout() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Create a test user
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('❌ Test user not found. Please create a user first.');
      return;
    }

    // Generate a token
    const token = jwt.sign(
      { 
        id: (testUser._id as any).toString(), 
        email: testUser.email, 
        name: testUser.name 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ Generated test token:', token.substring(0, 20) + '...');

    // Check if token is blacklisted (should be false)
    const isBlacklistedBefore = await BlacklistedToken.isBlacklisted(token);
    console.log('🔍 Token blacklisted before logout:', isBlacklistedBefore);

    // Simulate logout by blacklisting the token
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    await BlacklistedToken.blacklistToken(token, (testUser._id as any).toString(), expiration);
    console.log('✅ Token blacklisted successfully');

    // Check if token is blacklisted (should be true)
    const isBlacklistedAfter = await BlacklistedToken.isBlacklisted(token);
    console.log('🔍 Token blacklisted after logout:', isBlacklistedAfter);

    // Clean up expired tokens
    const deletedCount = await BlacklistedToken.cleanExpiredTokens();
    console.log('🧹 Cleaned expired tokens:', deletedCount);

    console.log('✅ Logout test completed successfully!');
  } catch (error) {
    console.error('❌ Error during logout test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testLogout(); 