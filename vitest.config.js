export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__mocks__/testSetup.ts']
  },
  resolve: {
    alias: {
      'vscode': new URL('./src/__mocks__/vscode.ts', import.meta.url).pathname
    }
  }
};