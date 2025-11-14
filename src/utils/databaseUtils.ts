import { connectDB, getCurrentDatabase, switchDatabase } from '../config/database';
import { Achievement } from '../models/Achievement';

/**
 * Database utility functions for managing different databases
 */

// Example: Connect to development database
export const connectToDevDB = async () => {
  await connectDB('development');
  console.log(`✅ Conectado a base de datos de desarrollo: ${getCurrentDatabase()}`);
};

// Example: Connect to test database
export const connectToTestDB = async () => {
  await connectDB('test');
  console.log(`✅ Conectado a base de datos de pruebas: ${getCurrentDatabase()}`);
};

// Example: Connect to production database
export const connectToProdDB = async () => {
  await connectDB('production');
  console.log(`✅ Conectado a base de datos de producción: ${getCurrentDatabase()}`);
};

// Example: Switch to a specific database (useful for testing)
export const switchToDatabase = async (databaseName: string) => {
  await switchDatabase(databaseName);
  console.log(`✅ Cambiado a base de datos: ${databaseName}`);
};

// Example: Get current database information
export const getDatabaseInfo = () => {
  const dbName = getCurrentDatabase();
  console.log(`📊 Base de datos actual: ${dbName}`);
  return dbName;
};

// Example: Create models in a specific database
export const createModelsInDatabase = async (databaseName: string) => {
  // Switch to the target database
  await switchToDatabase(databaseName);
  
  // Now all model operations will use this database
  const achievement = new Achievement({
    name: 'First Transaction',
    description: 'Complete your first financial transaction',
    icon: '💰',
    category: 'financial',
    criteria: {
      type: 'transaction_count',
      value: 1,
      timeframe: 'all_time'
    },
    reward: {
      experience: 10,
      coins: 5
    },
    rarity: 'common'
  });
  
  await achievement.save();
  console.log(`✅ Modelo creado en base de datos: ${databaseName}`);
};

// Example: List all collections in current database
export const listCollections = async () => {
  const db = require('mongoose').connection.db;
  const collections = await db.listCollections().toArray();
  console.log('📚 Colecciones en la base de datos actual:');
  collections.forEach((collection: any) => {
    console.log(`  - ${collection.name}`);
  });
  return collections;
}; 