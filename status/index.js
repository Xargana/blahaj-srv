const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 2589; // Change this if needed

const CHECK_INTERVAL = 30 * 1000; // 30 seconds
const REMOTE_SERVER = "http://example.com"; // Change this to your target server

let serverStatus = {
    online: false,
        lastChecked: null,
            responseTime: null,
            };

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

                                                            // Check the server at intervals
                                                            setInterval(checkServer, CHECK_INTERVAL);
                                                            checkServer(); // Initial check

                                                            // API route to get the status
                                                            app.get("/status", (req, res) => {
                                                                res.json(serverStatus);
                                                                });

                                                                app.listen(PORT, () => {
                                                                    console.log(`Server running on http://localhost:${PORT}`);
                                                                    });
