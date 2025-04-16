const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const CommandManager = require('./CommandManager');
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
    
    // Initialize command manager
    this.commandManager = new CommandManager(this.client);
    
    // Authorized user ID - CHANGE THIS to your Discord user ID
    this.authorizedUserId = process.env.AUTHORIZED_USER_ID;
    
    // Setup temp directory
    this.setupTempDirectory();
    
    // Setup event handlers
    this.setupEventHandlers();
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
      // Only process commands if:
      // 1. It's a DM channel
      // 2. The user is authorized
      if (interaction.channel?.type !== ChannelType.DM) {
        await interaction.reply({ 
          content: "This bot only works in direct messages for security reasons.", 
          ephemeral: true 
        });
        return;
      }
      
      if (interaction.user.id !== this.authorizedUserId) {
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
      title: "VPS Control Bot Status",
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
        text: "VPS Control Bot"
      }
    };
    
    // Only notify the authorized user
    try {
      const owner = await this.client.users.fetch(this.authorizedUserId);
      await owner.send({ embeds: [startupEmbed] });
      console.log(`Sent startup notification to authorized user: ${owner.tag}`);
    } catch (error) {
      console.error("Failed to send startup notification to authorized user:", error);
    }
  }
  
  async start() {
    // Login to Discord
    await this.client.login(process.env.DISCORD_TOKEN);
    return this;
  }
}

module.exports = Bot;
