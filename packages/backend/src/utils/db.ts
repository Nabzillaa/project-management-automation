import _prismaModule, { PrismaClient } from '@pm-app/database';
import { logger } from './logger.js';

// Handle CJS/ESM interop: tsx runs via ESM loader, so CJS default exports arrive as the whole exports object
const prisma: InstanceType<typeof PrismaClient> = (_prismaModule as any).default ?? _prismaModule;

// Connect to database
prisma
  .$connect()
  .then(() => {
    logger.info('✅ Database connected successfully');
  })
  .catch((error) => {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
});

export default prisma;
