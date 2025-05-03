const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
// load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const status = require("./status/status");
const exchangeRate = require("./exchange-rate/exchange-rate");
const whois = require("./whois/whois");
const messageBoard = require("./message-board/message-board");

// Main API app
const app = express();
const PORT = process.env.PORT || 2589;

// Message board app (separate instance)
const messageBoardApp = express();
const MESSAGE_BOARD_PORT = process.env.MESSAGE_BOARD_PORT || 2845;

// SSL certificate paths
const key = process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/xargana.tr/privkey.pem";
const cert = process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/xargana.tr/fullchain.pem";

// Configure main API app
app.use(cors());
app.use("/status", status);
app.use("/exchange-rate", exchangeRate);
app.use("/whois", whois);

// Configure message board app
messageBoardApp.use(cors());
messageBoardApp.use("/", messageBoard);

// Try to load SSL certificates
let sslOptions;
try {
    sslOptions = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
    };
} catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`SSL certificate file(s) not found: ${e.path}`);
    } else {
        console.warn(`Error loading SSL certificates: ${e.message}`);
    }
    sslOptions = null;
}

// Start main API server
if (sslOptions) {
    https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`Main API running at https://localhost:${PORT}`);
    });
} else {
    console.log("Starting main API server without SSL...");
    http.createServer(app).listen(PORT, () => {
        console.log(`Main API running at http://localhost:${PORT}`);
    });
}

// Start message board server
if (sslOptions) {
    https.createServer(sslOptions, messageBoardApp).listen(MESSAGE_BOARD_PORT, () => {
        console.log(`Message Board running at https://localhost:${MESSAGE_BOARD_PORT}`);
    });
} else {
    console.log("Starting Message Board server without SSL...");
    http.createServer(messageBoardApp).listen(MESSAGE_BOARD_PORT, () => {
        console.log(`Message Board running at http://localhost:${MESSAGE_BOARD_PORT}`);
    });
}
