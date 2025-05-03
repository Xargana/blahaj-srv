const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Path for persisting messages
const MESSAGES_FILE_PATH = path.join(__dirname, 'messages-cache.json');

// In-memory storage with persistence
let messages = [];

// Load existing messages from file if it exists
function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE_PATH)) {
            const data = fs.readFileSync(MESSAGES_FILE_PATH, 'utf8');
            messages = JSON.parse(data);
            console.log(`Loaded ${messages.length} messages from cache`);
        }
    } catch (error) {
        console.error("Error loading messages from cache:", error);
    }
}

// Save messages to file
function saveMessages() {
    try {
        fs.writeFileSync(MESSAGES_FILE_PATH, JSON.stringify(messages), 'utf8');
    } catch (error) {
        console.error("Error saving messages to cache:", error);
    }
}

// Load messages at startup
loadMessages();

// Submit a new message
router.post("/submit", express.json(), (req, res) => {
    try {
        const { name, message } = req.body;
        
        if (!name || !message) {
            return res.status(400).json({ error: "Missing name or message fields" });
        }
        
        messages.push({ 
            name, 
            message, 
            time: new Date().toISOString() 
        });
        
        // Keep only the latest 100 messages
        if (messages.length > 100) {
            messages = messages.slice(-100);
        }
        
        // Save to file after update
        saveMessages();
        
        res.json({ success: true, message: "Message received" });
    } catch (error) {
        console.error("Error handling message submission:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get messages as JSON
router.get("/", (req, res) => {
    try {
        res.json({ messages });
    } catch (error) {
        console.error("Error sending messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get messages as HTML
router.get("/html", (req, res) => {
    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Public Message Pool</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .message { border-bottom: 1px solid #eee; padding: 10px 0; }
                    .name { font-weight: bold; }
                    .time { color: #666; font-size: 0.8em; }
                </style>
            </head>
            <body>
                <h1>Public Message Pool</h1>
                ${messages.map(msg => `
                    <div class="message">
                        <span class="name">${msg.name}</span> 
                        <span class="time">[${msg.time}]</span>: 
                        <div class="content">${msg.message}</div>
                    </div>
                `).join('')}
            </body>
            </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error("Error sending HTML messages:", error);
        res.status(500).send("Internal server error");
    }
});

module.exports = router;