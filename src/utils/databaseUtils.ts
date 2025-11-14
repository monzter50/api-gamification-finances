import { connectDB, getCurrentDatabase, switchDatabase } from '../config/database';
import { Achievement } from '../models/Achievement';
import { logger } from '../config/logger';

/**
 * Database utility functions for managing different databases
 */

// Example: Connect to development database
export const connectToDevDB = async () => {
  await connectDB('development');
  logger.info(`✅ Conectado a base de datos de desarrollo: ${getCurrentDatabase()}`);
};

// Example: Connect to test database
export const connectToTestDB = async () => {
  await connectDB('test');
  logger.info(`✅ Conectado a base de datos de pruebas: ${getCurrentDatabase()}`);
};

// Example: Connect to production database
export const connectToProdDB = async () => {
  await connectDB('production');
  logger.info(`✅ Conectado a base de datos de producción: ${getCurrentDatabase()}`);
};

// Example: Switch to a specific database (useful for testing)
export const switchToDatabase = async (databaseName: string) => {
  await switchDatabase(databaseName);
  logger.info(`✅ Cambiado a base de datos: ${databaseName}`);
};

// Example: Get current database information
export const getDatabaseInfo = () => {
  const dbName = getCurrentDatabase();
  logger.info(`📊 Base de datos actual: ${dbName}`);
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
  logger.info(`✅ Modelo creado en base de datos: ${databaseName}`);
};

// Example: List all collections in current database
export const listCollections = async () => {
  const db = require('mongoose').connection.db;
  const collections = await db.listCollections().toArray();
  logger.info('📚 Colecciones en la base de datos actual:');
  collections.forEach((collection: any) => {
    logger.info(`  - ${collection.name}`);
  });
  return collections;
}; 