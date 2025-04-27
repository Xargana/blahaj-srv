// Discord Bot entry point
const path = require('path');
require('dotenv').config();

// Import the Bot class
const Bot = require('./discord/classes/Bot');

// Global variable to hold our bot
let discordBot;

async function startBot() {
  try {
    // Initialize and start Discord bot
    console.log('Starting Discord bot...');
    discordBot = new Bot();
    await discordBot.start();
    console.log('Discord bot started successfully');
    console.log('Discord bot fully operational');
  } catch (error) {
    console.error('Error starting Discord bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down Discord bot gracefully...`);
  
  // Shutdown Discord bot if it exists
  if (discordBot) {
    try {
      await discordBot.sendShutdownNotification(`Manual shutdown triggered by ${signal}`);
      await discordBot.stop();
      console.log('Discord bot shutdown complete');
    } catch (error) {
      console.error('Error shutting down Discord bot:', error);
    }
  }
  
  console.log('Discord bot shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in Discord bot:', error);
  if (discordBot) {
    discordBot.sendShutdownNotification('Uncaught exception', error)
      .finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Start bot
startBot();
