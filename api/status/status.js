const express = require("express");
const ping = require("ping");

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

// Initial check with error handling
try {
    checkServers();
} catch (error) {
    console.error("Error during initial check:", error);
}

// Set interval with error handling
setInterval(() => {
    try {
        checkServers();
    } catch (error) {
        console.error("Error during scheduled check:", error);
    }
}, CHECK_INTERVAL);

// Route with error handling
router.get("/", (req, res) => {
    try {
        res.json(serversStatus);
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
