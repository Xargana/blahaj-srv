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

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 2589;
const HTTPS_PORT = process.env.HTTPS_PORT || 2845;

const key = process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/blahaj.tr/privkey.pem";
const cert = process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/blahaj.tr/fullchain.pem";

app.use(cors());
app.use("/status", status);
app.use("/exchange-rate", exchangeRate);
app.use("/whois", whois);

// Start HTTP server
http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`API running at http://localhost:${HTTP_PORT}`);
});

// try to load certificates and start HTTPS server
try {
    const sslOptions = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
    };

    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
        console.log(`API running at https://localhost:${HTTPS_PORT}`);
    });
} catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`SSL certificate file(s) not found: ${e.path}`);
    } else {
        console.warn(`Error loading SSL certificates: ${e.message}`);
    }
    console.warn("HTTPS server could not be started");
}