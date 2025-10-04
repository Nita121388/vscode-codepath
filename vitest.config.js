export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'vscode': new URL('./src/__mocks__/vscode.ts', import.meta.url).pathname
    }
  }
};