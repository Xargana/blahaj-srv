const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const CommandManager = require('./CommandManager');
const NotificationService = require('./NotificationService');
const fs = require('fs');
const path = require('path');

class Bot {
  constructor() {
    // Initialize client with minimal required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
      ],
      partials: ['CHANNEL', 'MESSAGE']
    });
    
    // Add reference to this bot instance on the client for access from commands
    this.client.bot = this;

    // THIS IS IMPORTANT: Make sure CommandManager is initialized AFTER the client
    this.commandManager = new CommandManager(this.client);
    
    // Authorized users for commands - Parse comma-separated list from env variable
    this.authorizedUserIds = process.env.AUTHORIZED_USER_IDS 
      ? process.env.AUTHORIZED_USER_IDS.split(',').map(id => id.trim())
      : [];
    
    // For backward compatibility, add the old env var if it exists
    if (process.env.AUTHORIZED_USER_ID && !this.authorizedUserIds.includes(process.env.AUTHORIZED_USER_ID)) {
      this.authorizedUserIds.push(process.env.AUTHORIZED_USER_ID);
    }
    
    // Parse notification recipient IDs (separate from command authorization)
    this.notificationRecipientIds = process.env.NOTIFICATION_USER_IDS ? 
      process.env.NOTIFICATION_USER_IDS.split(',').map(id => id.trim()) : 
      this.authorizedUserIds; // Default to authorized users if not specified
    
    console.log(`Authorized users configured: ${this.authorizedUserIds.length}`);
    console.log(`Notification recipients configured: ${this.notificationRecipientIds.length}`);
    
    // Setup temp directory
    this.setupTempDirectory();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Initialize notification service
    this.notificationService = null;
  }
  
  setupTempDirectory() {
    const tempDir = path.join(__dirname, '../../temp');
    if (fs.existsSync(tempDir)) {
      console.log("Cleaning up temp directory...");
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    } else {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }
  
  setupEventHandlers() {
    // Ready event
    this.client.once("ready", async () => {
      console.log(`Logged in as ${this.client.user.tag}`);
      
      // Only register global commands for direct messages
      await this.commandManager.registerGlobalCommands();
      
      // Send startup notification
      await this.sendStartupNotification();
    });
    
    // Interaction event
    this.client.on("interactionCreate", async (interaction) => {
      // Only process commands if the user is authorized
      if (!this.authorizedUserIds.includes(interaction.user.id)) {
        console.log(`Unauthorized access attempt by ${interaction.user.tag} (${interaction.user.id})`);
        await interaction.reply({ 
          content: "You are not authorized to use this bot.", 
          ephemeral: true 
        });
        return;
      }
      
      console.log(`Authorized command: ${interaction.commandName} from ${interaction.user.tag}`);
      
      // Handle the interaction
      await this.commandManager.handleInteraction(interaction);
    });
    
    // Error handling
    process.on('unhandledRejection', error => {
      console.error('Unhandled promise rejection:', error);
    });
  }
  
  async sendStartupNotification() {
    // Create startup embed
    const startupEmbed = {
      title: "blahaj.tr bot status update",
      description: `Bot started successfully at <t:${Math.floor(Date.now() / 1000)}:F>`,
      color: 0x00ff00,
      fields: [
        {
          name: "Bot Name",
          value: this.client.user.tag,
          inline: true
        },
        {
          name: "Relative Time",
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        }
      ],
      footer: {
        text: "blahaj.tr"
      }
    };
    
    // Notify all recipients
    for (const userId of this.notificationRecipientIds) {
      try {
        const user = await this.client.users.fetch(userId);
        await user.send({ embeds: [startupEmbed] });
        console.log(`Sent startup notification to recipient: ${user.tag}`);
      } catch (error) {
        console.error(`Failed to send startup notification to user ${userId}:`, error.message);
      }
    }
  }
  
  async sendShutdownNotification(reason = "Manual shutdown", error = null) {
    // Create shutdown embed
    const shutdownEmbed = {
      title: "blahaj.tr bot status update",
      description: `Bot is shutting down at <t:${Math.floor(Date.now() / 1000)}:F>`,
      color: 0xFF0000,
      fields: [
        {
          name: "Bot Name",
          value: this.client.user.tag,
          inline: true
        },
        {
          name: "Shutdown Reason",
          value: reason || "Unknown",
          inline: true
        },
        {
          name: "Relative Time",
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
          inline: true
        }
      ],
      footer: {
        text: "blahaj.tr"
      }
    };
    
    if (error) {
      shutdownEmbed.fields.push({
        name: "Error Details",
        value: `\`\`\`\n${error.message || String(error).substring(0, 1000)}\n\`\`\``,
        inline: false
      });
    }
    
    // Stop notification service if running
    if (this.notificationService?.isRunning) {
      this.notificationService.stop();
    }
    
    // Notify authorized user
    try {
      const owner = await this.client.users.fetch(this.authorizedUserId);
      await owner.send({ embeds: [shutdownEmbed] });
      console.log(`Sent shutdown notification to authorized user: ${owner.tag}`);
    } catch (error) {
      console.error("Failed to send shutdown notification to authorized user:", error.message);
    }
    
    // Also notify in status channel if available
    if (this.notificationService?.statusChannel) {
      try {
        await this.notificationService.statusChannel.send({ embeds: [shutdownEmbed] });
        console.log(`Sent shutdown notification to status channel: ${this.notificationService.statusChannel.name}`);
      } catch (error) {
        console.error("Failed to send shutdown notification to status channel:", error.message);
      }
    }
  }
  
  async start() {
    // Login to Discord
    await this.client.login(process.env.DISCORD_TOKEN);
    return this;
  }
  
  async stop() {
    // Stop notification service
    if (this.notificationService) {
      this.notificationService.stop();
    }
    
    // Destroy the client
    if (this.client) {
      this.client.destroy();
    }
  }
}

module.exports = Bot;
