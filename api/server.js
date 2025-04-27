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
const PORT = process.env.PORT || 2589;

const key = process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/xargana.tr/privkey.pem";
const cert = process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/xargana.tr/fullchain.pem";

app.use(cors());
app.use("/status", status);
app.use("/exchange-rate", exchangeRate);
app.use("/whois", whois);

// try to load certificates
try {
    const sslOptions = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
    };

    https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`API running at https://localhost:${PORT}`);
    });
} catch (e) {
    if (e.code === 'ENOENT') {
        console.warn(`SSL certificate file(s) not found: ${e.path}`);
    } else {
        console.warn(`Error loading SSL certificates: ${e.message}`);
    }
    
    console.log("Starting server without SSL...");
    
    // start http server as fallback
    http.createServer(app).listen(PORT, () => {
        console.log(`API running at http://localhost:${PORT}`);
    });
}
