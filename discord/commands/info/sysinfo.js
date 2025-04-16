const SystemCommandBase = require('../../classes/SystemCommandBase');
const os = require('os');

class SystemInfo extends SystemCommandBase {
  constructor(client) {
    super(client);
    this.name = 'sysinfo';
    this.description = 'Get system information from the VPS';
  }
  
  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      // Get basic system info using Node.js
      const uptime = Math.floor(os.uptime());
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;
      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      
      const memTotal = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
      const memFree = Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100;
      const memUsed = Math.round((memTotal - memFree) * 100) / 100;
      const memPercent = Math.round((memUsed / memTotal) * 100);
      
      // Get more detailed info using system commands
      const { stdout: diskInfo } = await this.execCommand('df -h / | tail -n 1');
      const diskParts = diskInfo.trim().split(/\s+/);
      const diskTotal = diskParts[1] || 'N/A';
      const diskUsed = diskParts[2] || 'N/A';
      const diskFree = diskParts[3] || 'N/A';
      const diskPercent = diskParts[4] || 'N/A';
      
      const { stdout: loadAvg } = await this.execCommand('cat /proc/loadavg');
      const loadParts = loadAvg.trim().split(' ');
      const load1m = loadParts[0] || 'N/A';
      const load5m = loadParts[1] || 'N/A';
      const load15m = loadParts[2] || 'N/A';
      
      const infoEmbed = {
        title: "VPS System Information",
        color: 0x3498db,
        fields: [
          {
            name: "Hostname",
            value: os.hostname(),
            inline: true
          },
          {
            name: "Platform",
            value: `${os.type()} ${os.release()}`,
            inline: true
          },
          {
            name: "Uptime",
            value: uptimeString,
            inline: true
          },
          {
            name: "Memory",
            value: `${memUsed}GB / ${memTotal}GB (${memPercent}%)`,
            inline: true
          },
          {
            name: "Disk",
            value: `${diskUsed} / ${diskTotal} (${diskPercent})`,
            inline: true
          },
          {
            name: "Load Average",
            value: `${load1m} | ${load5m} | ${load15m}`,
            inline: true
          }
        ],
        timestamp: new Date(),
        footer: {
          text: "VPS Control Bot"
        }
      };
      
      await interaction.editReply({ embeds: [infoEmbed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply("Failed to get system information.");
    }
  }
}

module.exports = SystemInfo;
