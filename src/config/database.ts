import mongoose from 'mongoose';
import { logger } from './logger';

// Database configurations for different environments
logger.debug('🔍 Variables de entorno cargadas:');
logger.debug('  - MONGODB_URI_DEV:', process.env.MONGODB_URI_DEV ? '✅ Configurado' : '❌ No configurado');
logger.debug('  - MONGODB_URI:', process.env.MONGODB_URI ? '✅ Configurado' : '❌ No configurado');
logger.debug('  - NODE_ENV:', process.env.NODE_ENV || 'development');

const databaseConfigs = {
  development: {
    uri: process.env.MONGODB_URI_DEV || process.env.MONGODB_URI || 'mongodb://localhost:27017/gamification-finances-dev',
    name: 'gamification-finances-dev'
  },
  test: {
    uri: process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/gamification-finances-test',
    name: 'gamification-finances-test'
  },
  production: {
    uri: process.env.MONGODB_URI_PROD || process.env.MONGODB_URI || 'mongodb://localhost:27017/gamification-finances',
    name: 'gamification-finances'
  }
};

export const connectDB = async (environment: 'development' | 'test' | 'production' = 'development'): Promise<void> => {
  try {
    const config = databaseConfigs[environment];
    logger.info(`🔍 Configuración de la base de datos: ${config.uri}`);
    const conn = await mongoose.connect(config.uri);

    logger.info(`📦 MongoDB conectado: ${conn.connection.host}`);
    logger.info(`🗄️  Base de datos: ${config.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err: Error) => {
      logger.error('❌ Error de conexión a MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🔌 MongoDB desconectado');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('📦 Conexión a MongoDB cerrada por terminación de la aplicación');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Error al conectar a MongoDB:', (error as Error).message);
    process.exit(1);
  }
};

// Function to get current database name
export const getCurrentDatabase = (): string => {
  return mongoose.connection.db?.databaseName || 'unknown';
};

// Function to switch databases (useful for testing)
export const switchDatabase = async (databaseName: string): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  
  const baseUri = process.env.MONGODB_URI?.split('/').slice(0, -1).join('/') || 'mongodb://localhost:27017';
  const newUri = `${baseUri}/${databaseName}`;
  
  await mongoose.connect(newUri);
  logger.info(`🔄 Cambiado a base de datos: ${databaseName}`);
}; 