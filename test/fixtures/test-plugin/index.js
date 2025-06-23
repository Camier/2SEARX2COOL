module.exports = {
  activate: async (context) => {
    context.logger.info('Test plugin activated');
    
    // Test API access
    await context.api.cache.set('test-key', 'test-value');
    
    // Store activation state
    await context.store.set('activated', true);
  },
  
  deactivate: async () => {
    // Clean up
  }
};