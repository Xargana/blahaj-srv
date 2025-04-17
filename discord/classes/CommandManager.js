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
    
    // Add this line to load commands when the CommandManager is created
    this.loadCommands();
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
      console.log("Registering global commands...");
      
      const commandsData = this.commands.map(command => {
        const data = {
          name: command.name,
          description: command.description,
          options: command.options || [],
          // Add these lines for global availability in all contexts
          integration_types: [1], // Add integration type for global availability
          contexts: [0, 1, 2],    // Available in all contexts (DM, GROUP_DM, GUILD)
        };
        
        // If the command has an addOptions method, call it
        if (typeof command.addOptions === 'function') {
          data.options = command.addOptions(new SlashCommandBuilder()).options;
        }
        
        return data;
      });
      
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commandsData },
      );
      
      console.log(`Successfully registered ${commandsData.length} global commands`);
    } catch (error) {
      console.error('Error registering global commands:', error);
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

  async handleAutocomplete(interaction) {
    const command = this.commands.get(interaction.commandName);
    
    if (!command || typeof command.handleAutocomplete !== 'function') {
      return;
    }
    
    try {
      await command.handleAutocomplete(interaction);
    } catch (error) {
      console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
      // Respond with empty array as fallback
      await interaction.respond([]);
    }
  }
}

module.exports = CommandManager;
