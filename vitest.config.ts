import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/tests/',
        'src/scripts/',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/models': resolve(__dirname, './src/models'),
      '@/routes': resolve(__dirname, './src/routes'),
      '@/middleware': resolve(__dirname, './src/middleware'),
      '@/config': resolve(__dirname, './src/config'),
      '@/services': resolve(__dirname, './src/services'),
      '@/repositories': resolve(__dirname, './src/repositories'),
      '@/controllers': resolve(__dirname, './src/controllers'),
      '@/validators': resolve(__dirname, './src/validators'),
      '@/dto': resolve(__dirname, './src/dto'),
      '@/errors': resolve(__dirname, './src/errors'),
      '@/constants': resolve(__dirname, './src/constants')
    }
  }
}); 