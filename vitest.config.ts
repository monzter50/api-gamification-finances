import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    // exFAT volumes get macOS `._*` AppleDouble sidecars; they are not tests.
    exclude: [...configDefaults.exclude, '**/._*'],
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
      '@/config': resolve(__dirname, './src/config')
    }
  }
}); 