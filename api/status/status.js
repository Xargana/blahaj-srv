const express = require("express");
const ping = require("ping");
const pm2 = require("pm2");

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
    for (const server of REMOTE_SERVERS) {
        const startTime = Date.now();
        try {
            const res = await ping.promise.probe(server.host);
            serversStatus[server.name].online = res.alive;
            serversStatus[server.name].responseTime = res.time;
        } catch (error) {
            serversStatus[server.name].online = false;
            serversStatus[server.name].responseTime = null;
        }
        serversStatus[server.name].lastChecked = new Date().toISOString();
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
                    pm2ServicesStatus[process.name] = {
                        name: process.name,
                        id: process.pm_id,
                        status: process.pm2_env.status,
                        cpu: process.monit.cpu,
                        memory: process.monit.memory,
                        uptime: process.pm2_env.pm_uptime ? 
                               Date.now() - process.pm2_env.pm_uptime : 
                               null,
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
    await checkServers();
    await checkPM2Services();
}

setInterval(checkAll, CHECK_INTERVAL);
checkAll();

router.get("/", (req, res) => {
    res.json({
        servers: serversStatus,
        pm2Services: pm2ServicesStatus
    });
});

module.exports = router;
