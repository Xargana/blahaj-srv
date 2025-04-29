const express = require("express");
const ping = require("ping");
const pm2 = require("pm2");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const REMOTE_SERVERS = [
    { name: "xargana.tr", host: "xargana.tr" },
    { name: "xargana.com", host: "xargana.com" },
    { name: "home server", host: "31.223.36.208" }
]; 

const CHECK_INTERVAL = 5 * 1000;
const LOGS_DIR = path.join(__dirname, '../../logs');
const ONLINE_LOGS_DIR = path.join(LOGS_DIR, 'online');
const OFFLINE_LOGS_DIR = path.join(LOGS_DIR, 'offline');

// Create log directories if they don't exist
function ensureLogDirectories() {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(ONLINE_LOGS_DIR)) {
        fs.mkdirSync(ONLINE_LOGS_DIR, { recursive: true });
    }
    if (!fs.existsSync(OFFLINE_LOGS_DIR)) {
        fs.mkdirSync(OFFLINE_LOGS_DIR, { recursive: true });
    }
}

let serversStatus = {};
REMOTE_SERVERS.forEach(server => {
    serversStatus[server.name] = {
        online: false,
        lastChecked: null,
        responseTime: null,
    };
});

// Add PM2 services status object
let pm2ServicesStatus = {};

async function checkServers() {
    try {
        ensureLogDirectories();
        
        for (const server of REMOTE_SERVERS) {
            try {
                const res = await ping.promise.probe(server.host, {
                    timeout: 4, // Set a timeout of 4 seconds
                });
                serversStatus[server.name].online = res.alive;
                serversStatus[server.name].responseTime = res.time;
            } catch (error) {
                console.error(`Error pinging ${server.host}:`, error);
                serversStatus[server.name].online = false;
                serversStatus[server.name].responseTime = null;
            }
            serversStatus[server.name].lastChecked = new Date().toISOString();
            
            // Log server status to the appropriate folder
            const timestamp = new Date().toISOString();
            const serverStatus = serversStatus[server.name];
            const logFolder = serverStatus.online ? ONLINE_LOGS_DIR : OFFLINE_LOGS_DIR;
            const logFilePath = path.join(logFolder, `${server.name.replace(/\s+/g, '_')}.log`);
            
            // Create a human-readable log entry
            const logEntry = `[${timestamp}] Server: ${server.name} (${server.host})\n` +
                             `Status: ${serverStatus.online ? 'ONLINE' : 'OFFLINE'}\n` +
                             `Response Time: ${serverStatus.responseTime ? serverStatus.responseTime + 'ms' : 'N/A'}\n` +
                             `-----------------------------------\n`;
            
            // Append to log file
            fs.appendFile(logFilePath, logEntry, (err) => {
                if (err) {
                    console.error(`Error writing log file for ${server.name}:`, err);
                }
            });
        }
    } catch (error) {
        console.error("Error in checkServers function:", error);
    }
}

async function checkPM2Services() {
  return new Promise((resolve, reject) => {
      pm2.connect(function(err) {
          if (err) {
              console.error('Error connecting to PM2:', err);
              pm2.disconnect();
              resolve();
              return;
          }
          
          pm2.list((err, list) => {
              if (err) {
                  console.error('Error getting PM2 process list:', err);
                  pm2.disconnect();
                  resolve();
                  return;
              }
              
              // Update PM2 services status
              list.forEach(process => {
                  // Calculate uptime correctly - pm_uptime is a timestamp, not a duration
                  const uptimeMs = process.pm2_env.pm_uptime ? 
                                  Date.now() - process.pm2_env.pm_uptime : 
                                  null;
                  
                  pm2ServicesStatus[process.name] = {
                      name: process.name,
                      id: process.pm_id,
                      status: process.pm2_env.status,
                      cpu: process.monit ? process.monit.cpu : null,
                      memory: process.monit ? process.monit.memory : null,
                      uptime: uptimeMs, // Store the uptime in milliseconds
                      restarts: process.pm2_env.restart_time,
                      lastChecked: new Date().toISOString()
                  };
              });
              
              pm2.disconnect();
              resolve();
          });
      });
  });
}

async function checkAll() {
    try {
        await checkServers();
        await checkPM2Services();
    } catch (error) {
        console.error("Error in checkAll function:", error);
    }
}

// Initial check with error handling
try {
    // Ensure log directories exist at startup
    ensureLogDirectories();
    checkAll();
} catch (error) {
    console.error("Error during initial check:", error);
}

// Set interval with error handling
setInterval(() => {
    try {
        checkAll();
    } catch (error) {
        console.error("Error during scheduled check:", error);
    }
}, CHECK_INTERVAL);

// Route with error handling
router.get("/", (req, res) => {
    try {
        res.json({
            servers: serversStatus,
            pm2Services: pm2ServicesStatus
        });
    } catch (error) {
        console.error("Error sending status response:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Add a simple health check endpoint
router.get("/health", (req, res) => {
    res.status(200).send("OK");
});

module.exports = router;
