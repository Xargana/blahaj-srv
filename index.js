// Main application entry point
const path = require('path');
require('dotenv').config();

// Import the Bot class
const Bot = require('./discord');

// Global variables to hold our services
let apiServer;
let discordBot;

async function startServices() {
  try {
    // Start API server
    console.log('Starting API server...');
    apiServer = require('./api/server');
    console.log('API server started successfully');
    
    // Initialize and start Discord bot
    console.log('Starting Discord bot...');
    discordBot = new Bot();
    await discordBot.start();
    console.log('Discord bot started successfully');
    
    console.log('All services started - System fully operational');
  } catch (error) {
    console.error('Error starting services:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  // Shutdown Discord bot if it exists and has a shutdown method
  if (discordBot && typeof discordBot.sendShutdownNotification === 'function') {
    try {
      await discordBot.sendShutdownNotification(`Manual shutdown triggered by ${signal}`);
      console.log('Discord bot shutdown complete');
    } catch (error) {
      console.error('Error shutting down Discord bot:', error);
    }
  }
  
  // Add any API server shutdown logic here if needed
  
  console.log('Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  if (discordBot && typeof discordBot.sendShutdownNotification === 'function') {
    discordBot.sendShutdownNotification('Uncaught exception', error)
      .finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Start all services
startServices();
