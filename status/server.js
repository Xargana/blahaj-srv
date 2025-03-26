const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");

const app = express();
const PORT = 2589;
const REMOTE_SERVER = "https://example.com"; // Change this

const CHECK_INTERVAL = 30 * 1000;

let serverStatus = {
    online: false,
    lastChecked: null,
    responseTime: null,
};

app.use(cors());

async function checkServer() {
    const startTime = Date.now();
    try {
        await axios.get(REMOTE_SERVER, { timeout: 5000 });
        serverStatus.online = true;
    } catch (error) {
        serverStatus.online = false;
    }
    serverStatus.responseTime = Date.now() - startTime;
    serverStatus.lastChecked = new Date().toISOString();
}

setInterval(checkServer, CHECK_INTERVAL);
checkServer();

app.get("/", (req, res) => {
    res.json(serverStatus);
});

app.get("/", (req, res) => {
    res.send("<h1>Status API</h1><p>Use <code>/status</code> to check server status.</p>");
});

// Load SSL Certificates
const sslOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/blahaj.tr/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/blahaj.tr/fullchain.pem"),
};

// Start HTTPS Server
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`API running at https://blahaj.tr:${PORT}`);
});
