const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");
const ping = require("ping");

const app = express();
const PORT = 2589;
const key = "/etc/letsencrypt/live/blahaj.tr/privkey.pem"
const cert = "/etc/letsencrypt/live/blahaj.tr/fullchain.pem"
const REMOTE_SERVERS = [
    "blahaj.tr",
    "xargana.com",
    "srv.xargana.com"
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
            const res = await ping.promise.probe(server);
            serversStatus[server].online = res.alive;
            serversStatus[server].responseTime = res.time;
        } catch (error) {
            serversStatus[server].online = false;
            serversStatus[server].responseTime = null;
        }
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
    key: fs.readFileSync(key),
    cert: fs.readFileSync(cert),
};

// Start HTTPS Server
try {
    https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`API running at https://localhost:${PORT}`);
    });
} catch (e) {
    console.error("Error starting server:", e);
}
