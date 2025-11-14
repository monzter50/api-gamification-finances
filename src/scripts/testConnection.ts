import { connectDB, getCurrentDatabase } from '../config/database';
import { Achievement } from '../models/Achievement';
import { logger } from '../config/logger';

async function testMongoDBConnection() {
  try {
    logger.info('🔍 Testing MongoDB Atlas connection...\n');
    
    // Test development database connection
    logger.info('📡 Connecting to development database...');
    await connectDB('development');
    
    const dbName = getCurrentDatabase();
    logger.info(`✅ Successfully connected to: ${dbName}\n`);
    
    // Test creating a sample document
    logger.info('📝 Testing document creation...');
    const testAchievement = new Achievement({
      name: 'Connection Test',
      description: 'Test achievement to verify database connection',
      icon: '🧪',
      category: 'financial',
      criteria: {
        type: 'transaction_count',
        value: 1,
        timeframe: 'all_time'
      },
      reward: {
        experience: 5,
        coins: 2
      },
      rarity: 'common'
    });
    
    await testAchievement.save();
    logger.info('✅ Document created successfully!\n');
    
    // Test reading the document
    logger.info('📖 Testing document retrieval...');
    const foundAchievement = await Achievement.findOne({ name: 'Connection Test' });
    logger.info(`✅ Document retrieved: ${foundAchievement?.name}\n`);
    
    // Clean up test document
    logger.info('🧹 Cleaning up test document...');
    await Achievement.deleteOne({ name: 'Connection Test' });
    logger.info('✅ Test document removed\n');
    
    logger.info('🎉 All tests passed! MongoDB Atlas connection is working correctly.');
    
  } catch (error) {
    logger.error('❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the test
testMongoDBConnection(); 