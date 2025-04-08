const express = require("express");
const ping = require("ping");
const { execSync } = require("child_process");

const router = express.Router();

const REMOTE_SERVERS = [
    { name: "blahaj.tr", host: "blahaj.tr" },
    { name: "xargana.com", host: "xargana.com" },
    { name: "home server", host: "31.223.36.208" }
]; 

const CHECK_INTERVAL = 5 * 1000;

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
        for (const server of REMOTE_SERVERS) {
            try {
                const res = await ping.promise.probe(server.host, {
                    timeout: 2, // Set a timeout of 2 seconds
                });
                serversStatus[server.name].online = res.alive;
                serversStatus[server.name].responseTime = res.time;
            } catch (error) {
                console.error(`Error pinging ${server.host}:`, error);
                serversStatus[server.name].online = false;
                serversStatus[server.name].responseTime = null;
            }
            serversStatus[server.name].lastChecked = new Date().toISOString();
        }
    } catch (error) {
        console.error("Error in checkServers function:", error);
    }
}

function checkPM2Services() {
    try {
        // Use execSync to ensure we get the output immediately
        const output = execSync('pm2 jlist', { encoding: 'utf8' });
        
        try {
            const processList = JSON.parse(output);
            
            // Clear previous status
            pm2ServicesStatus = {};
            
            processList.forEach(process => {
                pm2ServicesStatus[process.name] = {
                    name: process.name,
                    id: process.pm_id,
                    status: process.pm2_env.status,
                    cpu: process.monit ? process.monit.cpu : null,
                    memory: process.monit ? process.monit.memory : null,
                    uptime: process.pm2_env.pm_uptime ? 
                           Math.floor((Date.now() - process.pm2_env.pm_uptime) / 1000) : 
                           null,
                    restarts: process.pm2_env.restart_time,
                    lastChecked: new Date().toISOString()
                };
            });
        } catch (parseError) {
            console.error(`Error parsing PM2 output: ${parseError.message}`);
        }
    } catch (error) {
        console.error(`Error executing pm2 jlist: ${error.message}`);
        
        // Try an alternative approach using pm2 list
        try {
            const output = execSync('pm2 list --format json', { encoding: 'utf8' });
            
            try {
                const processList = JSON.parse(output);
                
                // Clear previous status
                pm2ServicesStatus = {};
                
                processList.forEach(process => {
                    pm2ServicesStatus[process.name] = {
                        name: process.name,
                        id: process.pm_id,
                        status: process.status || 'unknown',
                        cpu: process.cpu || null,
                        memory: process.memory || null,
                        uptime: null, // Not available in this format
                        restarts: process.restart || 0,
                        lastChecked: new Date().toISOString()
                    };
                });
            } catch (parseError) {
                console.error(`Error parsing PM2 list output: ${parseError.message}`);
            }
        } catch (fallbackError) {
            console.error(`Error with fallback PM2 command: ${fallbackError.message}`);
            
            // Last resort: just check if processes are running using ps
            try {
                const output = execSync('ps aux | grep pm2', { encoding: 'utf8' });
                const lines = output.split('\n').filter(line => 
                    line.includes('PM2') && !line.includes('grep')
                );
                
                pm2ServicesStatus = {
                    'pm2-daemon': {
                        name: 'pm2-daemon',
                        status: lines.length > 0 ? 'online' : 'stopped',
                        lastChecked: new Date().toISOString()
                    }
                };
            } catch (psError) {
                console.error(`Error checking processes: ${psError.message}`);
                pm2ServicesStatus = { error: 'Unable to check PM2 processes' };
            }
        }
    }
}

function checkAll() {
    checkServers();
    checkPM2Services();
}

// Initial check with error handling
try {
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
