const SystemCommandBase = require('../../classes/SystemCommandBase');
const { SlashCommandBuilder } = require('discord.js');

class PM2Control extends SystemCommandBase {
  constructor(client) {
    super(client);
    this.name = 'pm2';
    this.description = 'Control PM2 processes';
  }
  
  addOptions(builder) {
    return builder
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all PM2 processes')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('info')
          .setDescription('Get detailed information about a PM2 process')
          .addStringOption(option =>
            option
              .setName('process')
              .setDescription('Process name or ID')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('start')
          .setDescription('Start a PM2 process')
          .addStringOption(option =>
            option
              .setName('process')
              .setDescription('Process name or ID')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('stop')
          .setDescription('Stop a PM2 process')
          .addStringOption(option =>
            option
              .setName('process')
              .setDescription('Process name or ID')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('restart')
          .setDescription('Restart a PM2 process')
          .addStringOption(option =>
            option
              .setName('process')
              .setDescription('Process name or ID')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('logs')
          .setDescription('Show recent logs for a PM2 process')
          .addStringOption(option =>
            option
              .setName('process')
              .setDescription('Process name or ID')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption(option =>
            option
              .setName('lines')
              .setDescription('Number of log lines to show')
              .setRequired(false)
          )
      );
  }
  
  async execute(interaction) {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'list':
          await this.handleListCommand(interaction);
          break;
          
        case 'info':
          await this.handleInfoCommand(interaction);
          break;
          
        case 'start':
          await this.handleStartCommand(interaction);
          break;
          
        case 'stop':
          await this.handleStopCommand(interaction);
          break;
          
        case 'restart':
          await this.handleRestartCommand(interaction);
          break;
          
        case 'logs':
          await this.handleLogsCommand(interaction);
          break;
          
        default:
          await interaction.editReply(`Unknown subcommand: ${subcommand}`);
      }
    } catch (error) {
      console.error(`Error executing PM2 command:`, error);
      await interaction.editReply({
        content: `Error executing command: ${error.message}`
      });
    }
  }
  
  async handleListCommand(interaction) {
    const { stdout } = await this.execCommand('pm2 jlist');
    
    try {
      const processes = JSON.parse(stdout);
      
      if (processes.length === 0) {
        await interaction.editReply('No PM2 processes found.');
        return;
      }
      
      const embed = {
        title: 'PM2 Process List',
        color: 0x3498db,
        fields: [],
        timestamp: new Date(),
        footer: { text: 'PM2 Process Manager' }
      };
      
      processes.forEach(proc => {
        // Format memory to MB
        const memory = Math.round(proc.monit.memory / (1024 * 1024) * 10) / 10;
        
        // Get appropriate status emoji
        let statusEmoji = '⚪';
        switch (proc.pm2_env.status) {
          case 'online': statusEmoji = '🟢'; break;
          case 'stopping': statusEmoji = '🟠'; break;
          case 'stopped': statusEmoji = '🔴'; break;
          case 'errored': statusEmoji = '❌'; break;
          case 'launching': statusEmoji = '🟡'; break;
        }
        
        // Calculate uptime
        const uptime = proc.pm2_env.status === 'online' ? 
          this.formatUptime(Date.now() - proc.pm2_env.pm_uptime) : 
          'Not running';
        
        embed.fields.push({
          name: `${statusEmoji} ${proc.name} (ID: ${proc.pm_id})`,
          value: [
            `**Status:** ${proc.pm2_env.status}`,
            `**CPU:** ${proc.monit.cpu}%`,
            `**Memory:** ${memory} MB`,
            `**Uptime:** ${uptime}`,
            `**Restarts:** ${proc.pm2_env.restart_time}`
          ].join('\n'),
          inline: true
        });
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error parsing PM2 process list:', error);
      await interaction.editReply({
        content: `Failed to parse PM2 process list: ${error.message}`,
        files: stdout.length > 0 ? [{ 
          attachment: Buffer.from(stdout), 
          name: 'pm2-list.json' 
        }] : []
      });
    }
  }
  
  async handleInfoCommand(interaction) {
    const processName = interaction.options.getString('process');
    
    // Get detailed info about the process
    const { success, stdout, stderr } = await this.execCommand(`pm2 show ${processName} --format json`);
    
    if (!success) {
      await interaction.editReply(`Failed to get info for PM2 process "${processName}":\n\`\`\`${stderr}\`\`\``);
      return;
    }
    
    try {
      // Parse the JSON output
      const procInfo = JSON.parse(stdout);
      
      // Get status emoji
      let statusEmoji = '⚪';
      switch (procInfo.status) {
        case 'online': statusEmoji = '🟢'; break;
        case 'stopping': statusEmoji = '🟠'; break;
        case 'stopped': statusEmoji = '🔴'; break;
        case 'errored': statusEmoji = '❌'; break;
        case 'launching': statusEmoji = '🟡'; break;
      }
      
      // Format memory
      const memory = procInfo.memory ? 
        Math.round(procInfo.memory / (1024 * 1024) * 10) / 10 : 
        0;
      
      // Create embed
      const embed = {
        title: `${statusEmoji} PM2 Process: ${procInfo.name}`,
        color: procInfo.status === 'online' ? 0x00FF00 : 0xFF0000,
        fields: [
          {
            name: 'General',
            value: [
              `**ID:** ${procInfo.pm_id}`,
              `**Status:** ${procInfo.status}`,
              `**Version:** ${procInfo.version || 'N/A'}`,
              `**Instances:** ${procInfo.exec_instances || 1}`,
              `**Exec Mode:** ${procInfo.exec_mode || 'N/A'}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Resources',
            value: [
              `**CPU:** ${procInfo.cpu || 0}%`,
              `**Memory:** ${memory} MB`,
              `**Uptime:** ${this.formatUptime(procInfo.pm_uptime) || 'Not running'}`,
              `**Restarts:** ${procInfo.restart_time || 0}`,
              `**Unstable Restarts:** ${procInfo.unstable_restarts || 0}`
            ].join('\n'),
            inline: true
          },
          {
            name: 'Paths',
            value: [
              `**Path:** ${procInfo.path || 'N/A'}`,
              `**Current Path:** ${procInfo.cwd || 'N/A'}`,
              `**Script:** ${procInfo.script || 'N/A'}`
            ].join('\n'),
            inline: false
          }
        ],
        timestamp: new Date(),
        footer: { text: 'PM2 Process Manager' }
      };
      
      // Add logs section if available
      if (procInfo.out_log_path || procInfo.error_log_path) {
        embed.fields.push({
          name: 'Logs',
          value: [
            `**Output:** ${procInfo.out_log_path || 'N/A'}`,
            `**Error:** ${procInfo.error_log_path || 'N/A'}`
          ].join('\n'),
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error parsing PM2 process info:', error);
      await interaction.editReply(`Failed to parse info for PM2 process "${processName}":\n\`\`\`${error.message}\`\`\``);
    }
  }
  
  async handleStartCommand(interaction) {
    const processName = interaction.options.getString('process');
    
    // First get current status
    const { success: infoSuccess, stdout: infoStdout } = await this.execCommand(`pm2 jlist`);
    let beforeStatus = 'unknown';
    
    if (infoSuccess) {
      try {
        const processes = JSON.parse(infoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          beforeStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list before start:', error);
      }
    }
    
    // Start the process
    await interaction.editReply(`Starting PM2 process \`${processName}\`...`);
    const { success, stdout, stderr } = await this.execCommand(`pm2 start ${processName}`);
    
    if (!success) {
      await interaction.editReply(`Failed to start PM2 process "${processName}":\n\`\`\`${stderr}\`\`\``);
      return;
    }
    
    // Get new status
    const { success: newInfoSuccess, stdout: newInfoStdout } = await this.execCommand(`pm2 jlist`);
    let afterStatus = 'unknown';
    
    if (newInfoSuccess) {
      try {
        const processes = JSON.parse(newInfoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          afterStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list after start:', error);
      }
    }
    
    // Create status emoji
    let statusEmoji = '⚪';
    switch (afterStatus) {
      case 'online': statusEmoji = '🟢'; break;
      case 'stopping': statusEmoji = '🟠'; break;
      case 'stopped': statusEmoji = '🔴'; break;
      case 'errored': statusEmoji = '❌'; break;
      case 'launching': statusEmoji = '🟡'; break;
    }
    
    await interaction.editReply(`PM2 process \`${processName}\` started.\n\nStatus: ${statusEmoji} ${afterStatus}\nPrevious status: ${beforeStatus}`);
  }
  
  async handleStopCommand(interaction) {
    const processName = interaction.options.getString('process');
    
    // First get current status
    const { success: infoSuccess, stdout: infoStdout } = await this.execCommand(`pm2 jlist`);
    let beforeStatus = 'unknown';
    
    if (infoSuccess) {
      try {
        const processes = JSON.parse(infoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          beforeStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list before stop:', error);
      }
    }
    
    // Stop the process
    await interaction.editReply(`Stopping PM2 process \`${processName}\`...`);
    const { success, stdout, stderr } = await this.execCommand(`pm2 stop ${processName}`);
    
    if (!success) {
      await interaction.editReply(`Failed to stop PM2 process "${processName}":\n\`\`\`${stderr}\`\`\``);
      return;
    }
    
    // Get new status
    const { success: newInfoSuccess, stdout: newInfoStdout } = await this.execCommand(`pm2 jlist`);
    let afterStatus = 'unknown';
    
    if (newInfoSuccess) {
      try {
        const processes = JSON.parse(newInfoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          afterStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list after stop:', error);
      }
    }
    
    // Create status emoji
    let statusEmoji = '⚪';
    switch (afterStatus) {
      case 'online': statusEmoji = '🟢'; break;
      case 'stopping': statusEmoji = '🟠'; break;
      case 'stopped': statusEmoji = '🔴'; break;
      case 'errored': statusEmoji = '❌'; break;
      case 'launching': statusEmoji = '🟡'; break;
    }
    
    await interaction.editReply(`PM2 process \`${processName}\` stopped.\n\nStatus: ${statusEmoji} ${afterStatus}\nPrevious status: ${beforeStatus}`);
  }
  
  async handleRestartCommand(interaction) {
    const processName = interaction.options.getString('process');
    
    // First get current status
    const { success: infoSuccess, stdout: infoStdout } = await this.execCommand(`pm2 jlist`);
    let beforeStatus = 'unknown';
    
    if (infoSuccess) {
      try {
        const processes = JSON.parse(infoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          beforeStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list before restart:', error);
      }
    }
    
    // Restart the process
    await interaction.editReply(`Restarting PM2 process \`${processName}\`...`);
    const { success, stdout, stderr } = await this.execCommand(`pm2 restart ${processName}`);
    
    if (!success) {
      await interaction.editReply(`Failed to restart PM2 process "${processName}":\n\`\`\`${stderr}\`\`\``);
      return;
    }
    
    // Get new status
    const { success: newInfoSuccess, stdout: newInfoStdout } = await this.execCommand(`pm2 jlist`);
    let afterStatus = 'unknown';
    
    if (newInfoSuccess) {
      try {
        const processes = JSON.parse(newInfoStdout);
        const proc = processes.find(p => p.name === processName || p.pm_id.toString() === processName);
        if (proc) {
          afterStatus = proc.pm2_env.status;
        }
      } catch (error) {
        console.error('Error parsing PM2 process list after restart:', error);
      }
    }
    
    // Create status emoji
    let statusEmoji = '⚪';
    switch (afterStatus) {
      case 'online': statusEmoji = '🟢'; break;
      case 'stopping': statusEmoji = '🟠'; break;
      case 'stopped': statusEmoji = '🔴'; break;
      case 'errored': statusEmoji = '❌'; break;
      case 'launching': statusEmoji = '🟡'; break;
    }
    
    await interaction.editReply(`PM2 process \`${processName}\` restarted.\n\nStatus: ${statusEmoji} ${afterStatus}\nPrevious status: ${beforeStatus}`);
  }
  
  async handleLogsCommand(interaction) {
    const processName = interaction.options.getString('process');
    const lines = interaction.options.getInteger('lines') || 20;
    
    // Get logs for the process
    await interaction.editReply(`Fetching logs for PM2 process \`${processName}\`...`);
    const { success, stdout, stderr } = await this.execCommand(`pm2 logs ${processName} --lines ${lines} --nostream --raw`);
    
    if (!success) {
      await interaction.editReply(`Failed to get logs for PM2 process "${processName}":\n\`\`\`${stderr}\`\`\``);
      return;
    }
    
    // Format the logs
    const logs = stdout.trim();
    
    if (!logs) {
      await interaction.editReply(`No logs found for PM2 process \`${processName}\`.`);
      return;
    }
    
    // If logs are too long, split into files
    if (logs.length > 1950) {
      await interaction.editReply({
        content: `Logs for PM2 process \`${processName}\` (last ${lines} lines):`,
        files: [{
          attachment: Buffer.from(logs),
          name: `${processName}-logs.txt`
        }]
      });
    } else {
      await interaction.editReply(`Logs for PM2 process \`${processName}\` (last ${lines} lines):\n\`\`\`\n${logs}\n\`\`\``);
    }
  }
  
  // Helper method to autocomplete process names
  async handleAutocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const { success, stdout } = await this.execCommand('pm2 jlist');
      
      if (!success) {
        return interaction.respond([]);
      }
      
      const processes = JSON.parse(stdout);
      const choices = processes.map(proc => ({
        name: `${proc.name} (${proc.pm2_env.status})`,
        value: proc.name
      }));
      
      // Filter choices based on user input
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue.toLowerCase())
      );
      
      await interaction.respond(filtered.slice(0, 25));
    } catch (error) {
      console.error('Error in PM2 autocomplete:', error);
      await interaction.respond([]);
    }
  }
  
  // Helper to format uptime
  formatUptime(ms) {
    if (!ms || ms <= 0) return 'Not running';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

module.exports = PM2Control;
