import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

export const connectDB = async (environment: 'development' | 'test' | 'production' = 'development'): Promise<void> => {
  try {
    logger.info('🔌 Connecting to PostgreSQL with Prisma...');
    await prisma.$connect();
    logger.info('📦 Prisma connected successfully');
  } catch (error) {
    logger.error('❌ Error connecting to Prisma:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('🔌 Prisma disconnected');
};

export default prisma;
