/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/ and https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The tests are pure functions (routing, directions), so no browser
    // environment is needed.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
