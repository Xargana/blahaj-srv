const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 2589; // Set the API to run on port 2589

const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const REMOTE_SERVER = "https://srv.xargana.com"; // Change this to the server you want to check

let serverStatus = {
    online: false,
    lastChecked: null,
    responseTime: null,
};

// Enable CORS to allow requests from other domains
app.use(cors());

// Function to check server status
async function checkServer() {
    const startTime = Date.now();
    try {
        await axios.get(REMOTE_SERVER, { timeout: 5000 }); // 5-second timeout
        serverStatus.online = true;
    } catch (error) {
        serverStatus.online = false;
    }
    serverStatus.responseTime = Date.now() - startTime;
    serverStatus.lastChecked = new Date().toISOString();
}

// Run the check every 30 seconds
setInterval(checkServer, CHECK_INTERVAL);
checkServer(); // Initial check

// API route to get the server status
app.get("/status", (req, res) => {
    res.json(serverStatus);
});

// Start the server on port 2589
app.listen(PORT, () => {
    console.log(`API running at https://localhost:${PORT}`);
});
