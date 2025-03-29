const express = require("express");
const cors = require("cors");
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

setInterval(checkServers, CHECK_INTERVAL);
checkServers();

router.get("/", (req, res) => {
    res.json(serversStatus);
});

module.exports = router;