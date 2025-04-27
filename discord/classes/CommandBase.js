const { SlashCommandBuilder } = require('discord.js');

class CommandBase {
  constructor(client) {
    this.client = client;
    this.name = '';
    this.description = '';
    this.options = [];
  }
  
  /**
   * Execute the command
   * @param {Interaction} interaction - The interaction object
   */
  async execute(interaction) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Defer the reply to the interaction
   * @param {Interaction} interaction - The interaction object
   * @param {boolean} ephemeral - Whether the reply should be ephemeral
   */
  async deferReply(interaction, ephemeral = false) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
    }
  }
  
  /**
   * Send a response to the interaction
   * @param {Interaction} interaction - The interaction object
   * @param {Object} options - The response options
   * @param {boolean} ephemeral - Whether the response should be ephemeral
   */
  async sendResponse(interaction, options, ephemeral = false) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      options.ephemeral = ephemeral;
      await interaction.reply(options);
    }
  }
  
  /**
   * Send an error response to the interaction
   * @param {Interaction} interaction - The interaction object
   * @param {string} message - The error message
   */
  async sendErrorResponse(interaction, message) {
    const errorEmbed = {
      title: "Error",
      description: message,
      color: 0xFF0000,
      timestamp: new Date()
    };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
  
  /**
   * Convert the command to JSON for registration
   */
  toJSON() {
    const builder = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setDMPermission(true);  // Allow commands in DMs
    
    // Add options if defined in the child class
    if (typeof this.addOptions === 'function') {
      this.addOptions(builder);
    }
    
    // Get the JSON representation
    const json = builder.toJSON();
    
    // Add contexts to make commands available everywhere
    json.contexts = [0, 1, 2];  // Available in all contexts (DM, GROUP_DM, GUILD)
    
    return json;
  }
}

module.exports = CommandBase;
