const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const http = require("http");
const status = require("./status/server")

const app = express();
const PORT = 2589;

const key = "/etc/letsencrypt/live/blahaj.tr/privkey.pem"
const cert = "/etc/letsencrypt/live/blahaj.tr/fullchain.pem"

app.use(cors());
app.use("/status", status);

// Try to load certificates
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
    
    // Start http server as fallback
    http.createServer(app).listen(PORT, () => {
        console.log(`API running at http://localhost:${PORT}`);
    });
}
