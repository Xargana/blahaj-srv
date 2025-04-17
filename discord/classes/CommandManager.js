const { Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

class CommandManager {
  constructor(client) {
    this.client = client;
    this.commands = new Collection();
    this.commandFolders = ['info', 'system']; // Only include info and system commands
    this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    this.authorizedUserId = process.env.AUTHORIZED_USER_ID;
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    
    // Only load commands from allowed folders
    for (const folder of this.commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      
      // Skip if folder doesn't exist
      if (!fs.existsSync(folderPath)) continue;
      
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const CommandClass = require(filePath);
        const command = new CommandClass(this.client);
        
        // Add authorization check to command
        const originalExecute = command.execute;
        command.execute = async function(interaction) {
          if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
            return interaction.reply({
              content: "You are not authorized to use this command.",
              ephemeral: true
            });
          }
          return originalExecute.call(this, interaction);
        };
        
        this.commands.set(command.name, command);
        console.log(`Loaded command: ${command.name}`);
      }
    }
  }

  async registerGlobalCommands() {
    try {
      await this.loadCommands();
      
      if (this.commands.size === 0) {
        console.log("No commands to register.");
        return;
      }
      
      const commandsData = this.commands.map(command => command.toJSON());
      
      console.log(`Started refreshing ${commandsData.length} application (/) commands.`);
      
      // Register as global commands for DMs
      const data = await this.rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commandsData },
      );
      
      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      console.error(error);
    }
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Double-check authorization
    if (interaction.user.id !== this.authorizedUserId) {
      return interaction.reply({
        content: "You are not authorized to use this command.",
        ephemeral: true
      });
    }
    
    const command = this.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      
      const errorMessage = {
        content: "There was an error while executing this command!",
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
}

module.exports = CommandManager;
