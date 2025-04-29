const axios = require('axios');

class NotificationService {
  constructor(client, options = {}) {
    this.client = client;
    this.authorizedUserId = process.env.AUTHORIZED_USER_ID;
    this.statusChannel = null;
    this.checkInterval = options.checkInterval || 5000; // Changed to 5 seconds default
    this.statusEndpoint = options.statusEndpoint || 'https://blahaj.tr:2589/status';
    this.notificationChannelId = process.env.STATUS_NOTIFICATION_CHANNEL;
    
    // Store the previous status to compare for changes
    this.previousStatus = {
      servers: {},
      pm2Services: {} // Changed from services to pm2Services to match API response
    };
    
    // Track if this is the first check (to avoid notifications on startup)
    this.isFirstCheck = true;
    
    // Indicate if the service is running
    this.isRunning = false;

    // Add counters to track consecutive failures before marking as offline
    this.failureTracking = {
      servers: {},
      pm2Services: {}
    };
    
    // Number of consecutive failures required before considering something truly offline
    this.failureThreshold = 3;
  }
  
  async initialize() {
    // Fetch the channel if a channel ID is provided
    if (this.notificationChannelId) {
      try {
        this.statusChannel = await this.client.channels.fetch(this.notificationChannelId);
        console.log(`Status notification channel set to: ${this.statusChannel.name}`);
      } catch (error) {
        console.error(`Failed to fetch status notification channel: ${error.message}`);
      }
    }
    
    // Do an initial check to populate the previous status
    try {
      const initialStatus = await this.fetchStatus();
      this.previousStatus = initialStatus;
      console.log('Initial status check complete');
    } catch (error) {
      console.error(`Initial status check failed: ${error.message}`);
    }
  }
  
  start() {
    if (this.isRunning) return;
    
    console.log(`Starting status notification service (checking every ${this.checkInterval/1000} seconds)`);
    this.isRunning = true;
    this.checkTimer = setInterval(() => this.checkStatus(), this.checkInterval);
    
    // Run the first check
    this.checkStatus();
  }
  
  stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping status notification service');
    clearInterval(this.checkTimer);
    this.isRunning = false;
  }
  
  async fetchStatus() {
    try {
      const response = await axios.get(this.statusEndpoint);
      return response.data;
    } catch (error) {
      console.error(`Error fetching status: ${error.message}`);
      throw error;
    }
  }
  
  async checkStatus() {
    try {
      const currentStatus = await this.fetchStatus();
      
      // Process current status and apply failure thresholds
      const processedStatus = this.processStatusWithThreshold(currentStatus);
      
      // Detect changes between previous status and processed status
      const changes = this.detectChanges(this.previousStatus, processedStatus);
      
      // If changes detected and not the first check, send notifications
      if (changes.length > 0 && !this.isFirstCheck) {
        await this.sendNotifications(changes, processedStatus);
      }
      
      // Update previous status and set first check to false
      this.previousStatus = processedStatus;
      this.isFirstCheck = false;
    } catch (error) {
      console.error(`Status check failed: ${error.message}`);
    }
  }
  
  processStatusWithThreshold(currentStatus) {
    const processedStatus = {
      servers: {...currentStatus.servers},
      pm2Services: {...currentStatus.pm2Services}
    };
    
    // Process servers
    for (const server in currentStatus.servers) {
      if (!currentStatus.servers[server].online) {
        // Initialize counter if it doesn't exist
        if (!this.failureTracking.servers[server]) {
          this.failureTracking.servers[server] = 0;
        }
        
        // Increment failures counter
        this.failureTracking.servers[server]++;
        
        // If failures haven't reached threshold, keep it as online in the processed status
        if (this.failureTracking.servers[server] < this.failureThreshold) {
          processedStatus.servers[server] = {
            ...currentStatus.servers[server],
            online: true // Keep it as online until threshold reached
          };
          console.log(`Server ${server} failure count: ${this.failureTracking.servers[server]}/${this.failureThreshold}`);
        } else {
          console.log(`Server ${server} marked offline after ${this.failureThreshold} consecutive failures`);
        }
      } else {
        // Reset counter if the server is online
        this.failureTracking.servers[server] = 0;
      }
    }
    
    // Process PM2 services
    for (const service in currentStatus.pm2Services) {
      if (currentStatus.pm2Services[service].status !== 'online') {
        // Initialize counter if it doesn't exist
        if (!this.failureTracking.pm2Services[service]) {
          this.failureTracking.pm2Services[service] = 0;
        }
        
        // Increment failures counter
        this.failureTracking.pm2Services[service]++;
        
        // If failures haven't reached threshold, keep it as online in the processed status
        if (this.failureTracking.pm2Services[service] < this.failureThreshold) {
          processedStatus.pm2Services[service] = {
            ...currentStatus.pm2Services[service],
            status: 'online' // Keep it as online until threshold reached
          };
          console.log(`Service ${service} failure count: ${this.failureTracking.pm2Services[service]}/${this.failureThreshold}`);
        } else {
          console.log(`Service ${service} marked as ${currentStatus.pm2Services[service].status} after ${this.failureThreshold} consecutive failures`);
        }
      } else {
        // Reset counter if the service is online
        this.failureTracking.pm2Services[service] = 0;
      }
    }
    
    return processedStatus;
  }
  
  detectChanges(previousStatus, currentStatus) {
    const changes = [];
    
    // Check for server status changes
    if (previousStatus.servers && currentStatus.servers) {
      for (const server in currentStatus.servers) {
        // New server or status changed
        if (!previousStatus.servers[server] || 
            previousStatus.servers[server].online !== currentStatus.servers[server].online) {
          changes.push({
            type: 'server',
            name: server,
            status: currentStatus.servers[server].online ? 'online' : 'offline',
            previous: previousStatus.servers[server]?.online ? 'online' : 'offline',
            isNew: !previousStatus.servers[server],
            responseTime: currentStatus.servers[server].responseTime
          });
        }
      }
      
      // Check for removed servers
      for (const server in previousStatus.servers) {
        if (!currentStatus.servers[server]) {
          changes.push({
            type: 'server',
            name: server,
            status: 'removed',
            previous: previousStatus.servers[server].online ? 'online' : 'offline'
          });
        }
      }
    }
    
    // Check for PM2 service status changes - updated to use pm2Services
    if (previousStatus.pm2Services && currentStatus.pm2Services) {
      for (const service in currentStatus.pm2Services) {
        if (!previousStatus.pm2Services[service] || 
            previousStatus.pm2Services[service].status !== currentStatus.pm2Services[service].status) {
          changes.push({
            type: 'service',
            name: service,
            status: currentStatus.pm2Services[service].status,
            previous: previousStatus.pm2Services[service]?.status || 'unknown',
            isNew: !previousStatus.pm2Services[service],
            details: currentStatus.pm2Services[service]
          });
        }
      }
      
      // Check for removed services
      for (const service in previousStatus.pm2Services) {
        if (!currentStatus.pm2Services[service]) {
          changes.push({
            type: 'service',
            name: service,
            status: 'removed',
            previous: previousStatus.pm2Services[service].status
          });
        }
      }
    }
    
    return changes;
  }
  
  async sendNotifications(changes, currentStatus) {
    if (changes.length === 0) return;
    
    // Create an embed for the notification
    const embed = {
      title: 'Status Change Detected',
      color: 0xFFAA00, // Amber color for notifications
      timestamp: new Date(),
      fields: [],
      footer: {
        text: 'blahaj.tr Status Monitor'
      }
    };
    
    // Add fields for each change
    changes.forEach(change => {
      let fieldContent = '';
      
      if (change.type === 'server') {
        const statusEmoji = change.status === 'online' ? '🟢' : (change.status === 'offline' ? '🔴' : '⚪');
        const previousEmoji = change.previous === 'online' ? '🟢' : (change.previous === 'offline' ? '🔴' : '⚪');
        
        if (change.isNew) {
          fieldContent = `${statusEmoji} New server detected: **${change.status}**`;
        } else if (change.status === 'removed') {
          fieldContent = `⚪ Server removed (was ${previousEmoji} **${change.previous}**)`;
        } else {
          fieldContent = `${previousEmoji} **${change.previous}** → ${statusEmoji} **${change.status}**`;
          if (change.responseTime !== 'unknown') {
            fieldContent += `\nResponse time: ${change.responseTime}ms`;
          }
        }
      } else if (change.type === 'service') {
        let statusEmoji = '⚪';
        switch (change.status) {
          case 'online': statusEmoji = '🟢'; break;
          case 'stopping': statusEmoji = '🟠'; break;
          case 'stopped': statusEmoji = '🔴'; break;
          case 'errored': statusEmoji = '❌'; break;
          case 'launching': statusEmoji = '🟡'; break;
        }
        
        let previousEmoji = '⚪';
        switch (change.previous) {
          case 'online': previousEmoji = '🟢'; break;
          case 'stopping': previousEmoji = '🟠'; break;
          case 'stopped': previousEmoji = '🔴'; break;
          case 'errored': previousEmoji = '❌'; break;
          case 'launching': previousEmoji = '🟡'; break;
        }
        
        if (change.isNew) {
          fieldContent = `${statusEmoji} New service detected: **${change.status}**`;
        } else if (change.status === 'removed') {
          fieldContent = `⚪ Service removed (was ${previousEmoji} **${change.previous}**)`;
        } else {
          fieldContent = `${previousEmoji} **${change.previous}** → ${statusEmoji} **${change.status}**`;
          
          // Add resource usage if available
          if (change.details) {
            const memory = change.details.memory ? Math.round(change.details.memory / (1024 * 1024) * 10) / 10 : 0;
            fieldContent += `\nCPU: ${change.details.cpu}% | Memory: ${memory}MB`;
            fieldContent += `\nUptime: ${Math.floor(change.details.uptime / 1000)}s | Restarts: ${change.details.restarts}`;
          }
        }
      }
      
      embed.fields.push({
        name: `${change.type === 'server' ? 'Server' : 'Service'}: ${change.name}`,
        value: fieldContent,
        inline: false
      });
    });
    
    // Add a detailed status field if there are many services
    if (Object.keys(currentStatus.pm2Services || {}).length > 0) {
      let servicesStatus = '';
      for (const [name, info] of Object.entries(currentStatus.pm2Services)) {
        let statusEmoji = '⚪';
        switch (info.status) {
          case 'online': statusEmoji = '🟢'; break;
          case 'stopping': statusEmoji = '🟠'; break;
          case 'stopped': statusEmoji = '🔴'; break;
          case 'errored': statusEmoji = '❌'; break;
          case 'launching': statusEmoji = '🟡'; break;
        }
        servicesStatus += `${statusEmoji} **${name}**: ${info.status}\n`;
      }
      
      if (servicesStatus) {
        embed.fields.push({
          name: 'Current Services Status',
          value: servicesStatus,
          inline: false
        });
      }
    }
    
    // Send to channel if available
    if (this.statusChannel) {
      try {
        await this.statusChannel.send({ embeds: [embed] });
        console.log('Status change notification sent to channel');
      } catch (error) {
        console.error(`Failed to send status notification to channel: ${error.message}`);
      }
    }
    
    // Send to owner
    if (this.authorizedUserId) {
      try {
        const owner = await this.client.users.fetch(this.authorizedUserId);
        await owner.send({ embeds: [embed] });
        console.log('Status change notification sent to owner');
      } catch (error) {
        console.error(`Failed to send status notification to owner: ${error.message}`);
      }
    }
  }
}

module.exports = NotificationService;
