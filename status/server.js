const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");

const app = express();
const PORT = 2589;
const REMOTE_SERVERS = [
    "https://blahaj.tr",
    "https://xargana.com",
    "http://srv.xargana.com"
]; 

const CHECK_INTERVAL = 5 * 1000;

let serversStatus = {};
REMOTE_SERVERS.forEach(server => {
    serversStatus[server] = {
        online: false,
        lastChecked: null,
        responseTime: null,
    };
});

app.use(cors());

async function checkServers() {
    for (const server of REMOTE_SERVERS) {
        const startTime = Date.now();
        try {
            await axios.get(server, { timeout: 5000 });
            serversStatus[server].online = true;
        } catch (error) {
            serversStatus[server].online = false;
        }
        serversStatus[server].responseTime = Date.now() - startTime;
        serversStatus[server].lastChecked = new Date().toISOString();
    }
}

setInterval(checkServers, CHECK_INTERVAL);
checkServers();

app.get("/", (req, res) => {
    res.json(serversStatus);
});

// Load SSL Certificates
const sslOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/blahaj.tr/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/blahaj.tr/fullchain.pem"),
};

// Start HTTPS Server
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`API running at https://localhost:${PORT}`);
});