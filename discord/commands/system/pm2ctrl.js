const SystemCommandBase = require('../../classes/SystemCommandBase');
const { SlashCommandBuilder } = require('discord.js');

class PM2Control extends SystemCommandBase {
  constructor(client) {
    super(client);
    this.name = 'pm2';
    this.description = 'Control PM2 processes on the server';
  }
  
  addOptions(builder) {
    builder
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all PM2 processes')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('restart')
          .setDescription('Restart a PM2 process')
          .addStringOption(option =>
            option.setName('process')
              .setDescription('Process name or ID to restart')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('stop')
          .setDescription('Stop a PM2 process')
          .addStringOption(option =>
            option.setName('process')
              .setDescription('Process name or ID to stop')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('start')
          .setDescription('Start a stopped PM2 process')
          .addStringOption(option =>
            option.setName('process')
              .setDescription('Process name or ID to start')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('logs')
          .setDescription('Get logs from a PM2 process')
          .addStringOption(option =>
            option.setName('process')
              .setDescription('Process name or ID to get logs from')
              .setRequired(true)
          )
          .addIntegerOption(option =>
            option.setName('lines')
              .setDescription('Number of log lines to retrieve')
              .setRequired(false)
          )
      );
  }
  
  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      // Get the subcommand
      const subcommand = interaction.options.getSubcommand();
      
      // Handle each subcommand
      switch (subcommand) {
        case 'list':
          await this.handleListCommand(interaction);
          break;
        case 'restart':
          await this.handleRestartCommand(interaction);
          break;
        case 'stop':
          await this.handleStopCommand(interaction);
          break;
        case 'start':
          await this.handleStartCommand(interaction);
          break;
        case 'logs':
          await this.handleLogsCommand(interaction);
          break;
        default:
          await interaction.editReply('Unknown subcommand');
      }
    } catch (error) {
      console.error('PM2 command error:', error);
      await this.sendErrorResponse(interaction, `Error executing PM2 command: ${error.message}`);
    }
  }
  
  async handleListCommand(interaction) {
    const { stdout, stderr, success } = await this.execCommand('pm2 jlist');
    
    if (!success) {
      return await this.sendErrorResponse(interaction, `Failed to list PM2 processes: ${stderr}`);
    }
    
    try {
      const processes = JSON.parse(stdout);
      if (processes.length === 0) {
        return await interaction.editReply('No PM2 processes found');
      }
      
      const embed = {
        title: 'PM2 Processes',
        color: 0x00FF00,
        fields: [],
        timestamp: new Date(),
        footer: {
          text: 'blahaj.tr PM2 Manager'
        }
      };
      
      for (const proc of processes) {
        // Get the status emoji
        let statusEmoji = '⚪';
        switch (proc.pm2_env.status) {
          case 'online': statusEmoji = '🟢'; break;
          case 'stopping': statusEmoji = '🟠'; break;
          case 'stopped': statusEmoji = '🔴'; break;
          case 'errored': statusEmoji = '❌'; break;
          case 'launching': statusEmoji = '🟡'; break;
        }
        
        // Calculate memory in MB
        const memoryUsage = proc.monit?.memory ? Math.round(proc.monit.memory / 1024 / 1024 * 100) / 100 : 0;
        
        // Calculate uptime
        const uptime = proc.pm2_env?.pm_uptime ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000) : 0;
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeStr = days > 0 ? 
          `${days}d ${hours}h ${minutes}m` : 
          `${hours}h ${minutes}m`;
        
        embed.fields.push({
          name: `${statusEmoji} ${proc.name} (id: ${proc.pm_id})`,
          value: `**Status:** ${proc.pm2_env.status}\n` +
                 `**Memory:** ${memoryUsage} MB\n` +
                 `**CPU:** ${proc.monit?.cpu || 0}%\n` + 
                 `**Uptime:** ${uptimeStr}\n` +
                 `**Restarts:** ${proc.pm2_env.restart_time || 0}`,
          inline: true
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      return await this.sendErrorResponse(interaction, `Error parsing PM2 process list: ${error.message}`);
    }
  }
  
  async handleRestartCommand(interaction) {
    const processId = interaction.options.getString('process');
    
    // Validate input to prevent command injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(processId)) {
      return await this.sendErrorResponse(interaction, 'Invalid process name or ID. Use only alphanumeric characters, underscores, dots, or hyphens.');
    }
    
    await interaction.editReply(`Restarting PM2 process: ${processId}...`);
    
    const { stdout, stderr, success } = await this.execCommand(`pm2 restart ${processId}`);
    
    if (success) {
      const embed = {
        title: 'PM2 Process Restarted',
        description: `Successfully restarted process: **${processId}**`,
        color: 0x00FF00,
        timestamp: new Date(),
        footer: {
          text: 'blahaj.tr PM2 Manager'
        }
      };
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await this.sendErrorResponse(interaction, `Failed to restart process: ${stderr || stdout}`);
    }
  }
  
  async handleStopCommand(interaction) {
    const processId = interaction.options.getString('process');
    
    // Validate input to prevent command injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(processId)) {
      return await this.sendErrorResponse(interaction, 'Invalid process name or ID. Use only alphanumeric characters, underscores, dots, or hyphens.');
    }
    
    await interaction.editReply(`Stopping PM2 process: ${processId}...`);
    
    const { stdout, stderr, success } = await this.execCommand(`pm2 stop ${processId}`);
    
    if (success) {
      const embed = {
        title: 'PM2 Process Stopped',
        description: `Successfully stopped process: **${processId}**`,
        color: 0xFFA500, // Orange color
        timestamp: new Date(),
        footer: {
          text: 'blahaj.tr PM2 Manager'
        }
      };
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await this.sendErrorResponse(interaction, `Failed to stop process: ${stderr || stdout}`);
    }
  }
  
  async handleStartCommand(interaction) {
    const processId = interaction.options.getString('process');
    
    // Validate input to prevent command injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(processId)) {
      return await this.sendErrorResponse(interaction, 'Invalid process name or ID. Use only alphanumeric characters, underscores, dots, or hyphens.');
    }
    
    await interaction.editReply(`Starting PM2 process: ${processId}...`);
    
    const { stdout, stderr, success } = await this.execCommand(`pm2 start ${processId}`);
    
    if (success) {
      const embed = {
        title: 'PM2 Process Started',
        description: `Successfully started process: **${processId}**`,
        color: 0x00FF00,
        timestamp: new Date(),
        footer: {
          text: 'blahaj.tr PM2 Manager'
        }
      };
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await this.sendErrorResponse(interaction, `Failed to start process: ${stderr || stdout}`);
    }
  }
  
  async handleLogsCommand(interaction) {
    const processId = interaction.options.getString('process');
    const lines = interaction.options.getInteger('lines') || 10;
    
    // Validate input to prevent command injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(processId)) {
      return await this.sendErrorResponse(interaction, 'Invalid process name or ID. Use only alphanumeric characters, underscores, dots, or hyphens.');
    }
    
    // Limit number of lines to prevent huge messages
    const safeLinesCount = Math.min(lines, 30);
    
    await interaction.editReply(`Fetching last ${safeLinesCount} lines of logs for ${processId}...`);
    
    const { stdout, stderr, success } = await this.execCommand(`pm2 logs ${processId} --lines ${safeLinesCount} --nostream`);
    
    if (success) {
      // Format the logs into a manageable message
      let logsContent = stdout.trim();
      
      // If logs are too long, truncate
      if (logsContent.length > 1900) {
        logsContent = logsContent.substring(logsContent.length - 1900) + '...';
      }
      
      const embed = {
        title: `PM2 Logs: ${processId}`,
        color: 0x3498db,
        description: `Last ${safeLinesCount} lines of logs:`,
        timestamp: new Date(),
        footer: {
          text: 'blahaj.tr PM2 Manager'
        }
      };
      
      await interaction.editReply({ 
        embeds: [embed],
        content: `\`\`\`\n${logsContent || 'No logs available'}\n\`\`\``
      });
    } else {
      await this.sendErrorResponse(interaction, `Failed to get logs: ${stderr || 'Unknown error'}`);
    }
  }
}

module.exports = PM2Control;
