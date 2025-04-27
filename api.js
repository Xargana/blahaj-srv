// API Server entry point
const path = require('path');
require('dotenv').config();

// Global variable to hold our service
let apiServer;

async function startServer() {
  try {
    // Start API server
    console.log('Starting API server...');
    apiServer = require('./api/server');
    console.log('API server started successfully');
    console.log('API server fully operational');
  } catch (error) {
    console.error('Error starting API server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down API server gracefully...`);
  
  // Add API server shutdown logic here if needed
  // For example: apiServer.close()
  
  console.log('API server shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in API server:', error);
  process.exit(1);
});

// Start server
startServer();
