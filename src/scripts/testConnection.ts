import { connectDB, getCurrentDatabase } from '../config/database';
import { Achievement } from '../models/Achievement';

async function testMongoDBConnection() {
  try {
    console.log('🔍 Testing MongoDB Atlas connection...\n');
    
    // Test development database connection
    console.log('📡 Connecting to development database...');
    await connectDB('development');
    
    const dbName = getCurrentDatabase();
    console.log(`✅ Successfully connected to: ${dbName}\n`);
    
    // Test creating a sample document
    console.log('📝 Testing document creation...');
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
    console.log('✅ Document created successfully!\n');
    
    // Test reading the document
    console.log('📖 Testing document retrieval...');
    const foundAchievement = await Achievement.findOne({ name: 'Connection Test' });
    console.log(`✅ Document retrieved: ${foundAchievement?.name}\n`);
    
    // Clean up test document
    console.log('🧹 Cleaning up test document...');
    await Achievement.deleteOne({ name: 'Connection Test' });
    console.log('✅ Test document removed\n');
    
    console.log('🎉 All tests passed! MongoDB Atlas connection is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the test
testMongoDBConnection(); 