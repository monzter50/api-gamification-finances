import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../config/swagger.config';
import { logger } from '../config/logger';

const outputPath = path.resolve(process.cwd(), 'openapi-schema.json');

try {
  fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
  logger.info(`✅ OpenAPI schema exported successfully to ${outputPath}`);
} catch (error) {
  logger.error('❌ Error exporting OpenAPI schema:', error);
  process.exit(1);
}
