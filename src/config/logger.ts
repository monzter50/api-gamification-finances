import { Logger, LogLevel } from '@aglaya/logger';

// Configure logger based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Determine log level based on environment
let logLevel: LogLevel;
if (isTest) {
  logLevel = LogLevel.SILENT;
} else if (isDevelopment) {
  logLevel = LogLevel.DEBUG;
} else {
  logLevel = LogLevel.INFO;
}

// Create logger instance with appropriate configuration
export const logger = new Logger({
  level: logLevel,
  prefix: 'GameFinanceAPI',
  colors: isDevelopment,
  timestamps: true
});

// Export specific log level functions for convenience
export const { debug, info, warn, error } = logger;

export default logger;
