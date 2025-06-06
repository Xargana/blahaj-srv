const express = require("express");
const ping = require("ping");
const pm2 = require("pm2");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require("../../firebase-service-account.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
}

const router = express.Router();

const REMOTE_SERVERS = [
      { name : "google.com", host: "google.com" },
      { name: "xargana.tr", host: "xargana.tr"}
  //  { name: "home server", host: "31.223.36.208" } removed cause router not behaving, dropped all pings today.
]; 

const CHECK_INTERVAL = 5 * 1000;
const LOGS_DIR = path.join(__dirname, '../../logs');
const ONLINE_LOGS_DIR = path.join(LOGS_DIR, 'online');
const OFFLINE_LOGS_DIR = path.join(LOGS_DIR, 'offline');

// Number of offline cycles before sending a notification
const NOTIFICATION_THRESHOLD = 3;

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

// Track previous states for notifications
let previousServersStatus = {};
let previousPM2Status = {};

// Track consecutive offline cycles
let serverFailureCounts = {};
let pm2FailureCounts = {};

let serversStatus = {};
REMOTE_SERVERS.forEach(server => {
    serversStatus[server.name] = {
        online: false,
        lastChecked: null,
        responseTime: null,
    };
    // Initialize previous status
    previousServersStatus[server.name] = false;
    // Initialize failure counters
    serverFailureCounts[server.name] = 0;
});

// Add PM2 services status object
let pm2ServicesStatus = {};

// Function to send FCM notification
async function sendFCMNotification(message, topic) {
    try {
        if (!admin.apps.length) {
            console.warn("Firebase Admin not initialized, skipping notification");
            return;
        }

        // Create the message object according to Firebase Admin SDK format
        const fcmMessage = {
            topic: topic,
            notification: {
                title: 'Server Status Alert',
                body: message
            },
            data: {
                type: 'server_status',
                timestamp: Date.now().toString()
            }
        };

        await admin.messaging().send(fcmMessage);
        console.log(`Notification sent: ${message}`);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

async function checkServers() {
    try {
        ensureLogDirectories();
        
        for (const server of REMOTE_SERVERS) {
            try {
                const res = await ping.promise.probe(server.host, {
                    timeout: 4, // Set a timeout of 4 seconds
                });
                
                // Get previous status before updating
                const wasOnline = previousServersStatus[server.name];
                const isNowOnline = res.alive;
                
                // Update status
                serversStatus[server.name].online = isNowOnline;
                serversStatus[server.name].responseTime = res.time;
                
                if (isNowOnline) {
                    // Service is online
                    
                    // Reset failure counter
                    serverFailureCounts[server.name] = 0;
                    
                    // If service was previously offline, send online notification
                    if (wasOnline === false) {
                        await sendFCMNotification(`Server ${server.name} is back online`, 'service_online');
                    }
                } else {
                    // Service is offline
                    
                    // Increment failure counter
                    serverFailureCounts[server.name]++;
                    
                    // Check if we've reached the notification threshold
                    if (serverFailureCounts[server.name] === NOTIFICATION_THRESHOLD) {
                        await sendFCMNotification(`Server ${server.name} is offline (after ${NOTIFICATION_THRESHOLD} checks)`, 'service_offline');
                    }
                }
                
                // Update previous status
                previousServersStatus[server.name] = isNowOnline;
                
            } catch (error) {
                console.error(`Error pinging ${server.host}:`, error);
                serversStatus[server.name].online = false;
                serversStatus[server.name].responseTime = null;
                
                // Increment failure counter
                serverFailureCounts[server.name]++;
                
                // Check if we've reached the notification threshold
                if (serverFailureCounts[server.name] === NOTIFICATION_THRESHOLD) {
                    await sendFCMNotification(`Server ${server.name} is unreachable (after ${NOTIFICATION_THRESHOLD} checks)`, 'service_offline');
                }
                
                // Update previous status
                previousServersStatus[server.name] = false;
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
                             `Failure Count: ${serverFailureCounts[server.name]}\n` +
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
            
            pm2.list(async (err, list) => {
                if (err) {
                    console.error('Error getting PM2 process list:', err);
                    pm2.disconnect();
                    resolve();
                    return;
                }
                
                try {
                    // Process each PM2 service sequentially with proper async handling
                    for (const process of list) {
                        const uptimeMs = process.pm2_env.pm_uptime ? 
                                        Date.now() - process.pm2_env.pm_uptime : 
                                        null;
                        
                        const processName = process.name;
                        const isNowOnline = process.pm2_env.status === 'online';
                        
                        // Check if we've seen this process before
                        if (previousPM2Status[processName] === undefined) {
                            // First time seeing this process - initialize and don't send notification
                            previousPM2Status[processName] = isNowOnline;
                            pm2FailureCounts[processName] = 0;
                            console.log(`Initializing PM2 service status for ${processName}: ${isNowOnline ? 'online' : 'offline'}`);
                        } else {
                            if (isNowOnline) {
                                // Service is online - reset failure counter
                                pm2FailureCounts[processName] = 0;
                                
                                // If service was previously offline, send online notification
                                if (previousPM2Status[processName] === false) {
                                    await sendFCMNotification(`PM2 service ${processName} is back online`, 'service_online');
                                    console.log(`PM2 service ${processName} changed from offline to online`);
                                }
                            } else {
                                // Service is offline - increment failure counter
                                pm2FailureCounts[processName]++;
                                
                                // Only send notification if threshold is reached
                                if (pm2FailureCounts[processName] === NOTIFICATION_THRESHOLD) {
                                    await sendFCMNotification(`PM2 service ${processName} is offline (status: ${process.pm2_env.status}, after ${NOTIFICATION_THRESHOLD} checks)`, 'service_offline');
                                    console.log(`PM2 service ${processName} is offline for ${NOTIFICATION_THRESHOLD} consecutive checks`);
                                }
                            }
                        }
                        
                        // Update previous status
                        previousPM2Status[processName] = isNowOnline;
                        
                        // Update status object
                        pm2ServicesStatus[processName] = {
                            name: processName,
                            id: process.pm_id,
                            status: process.pm2_env.status,
                            cpu: process.monit ? process.monit.cpu : null,
                            memory: process.monit ? process.monit.memory : null,
                            uptime: uptimeMs,
                            restarts: process.pm2_env.restart_time,
                            failureCount: pm2FailureCounts[processName],
                            lastChecked: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    console.error('Error processing PM2 services:', error);
                }
                
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
            pm2Services: pm2ServicesStatus,
            serverFailureCounts: serverFailureCounts,
            pm2FailureCounts: pm2FailureCounts,
            notificationThreshold: NOTIFICATION_THRESHOLD
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
