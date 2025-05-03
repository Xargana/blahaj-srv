const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Path for persisting messages
const MESSAGES_FILE_PATH = path.join(__dirname, 'messages-cache.json');

// In-memory storage with persistence
let messages = [];
// Store active polling connections
let pendingConnections = [];
// Track the last message ID to help clients know what's new
let lastMessageId = 0;

// Load existing messages from file if it exists
function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE_PATH)) {
            const data = fs.readFileSync(MESSAGES_FILE_PATH, 'utf8');
            messages = JSON.parse(data);
            console.log(`Loaded ${messages.length} messages from cache`);
            
            // Set the initial lastMessageId based on loaded messages
            if (messages.length > 0) {
                lastMessageId = messages.length;
                // Add ID to each message if not present
                messages.forEach((msg, index) => {
                    if (!msg.id) msg.id = index + 1;
                });
            }
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

// Notify all pending connections about new messages
function notifyNewMessages() {
    const connectionsToNotify = [...pendingConnections];
    pendingConnections = [];
    
    connectionsToNotify.forEach(connection => {
        const { res, lastId } = connection;
        sendNewMessages(res, lastId);
    });
}

// Send new messages to a client
function sendNewMessages(res, lastKnownId) {
    const newMessages = messages.filter(msg => msg.id > lastKnownId);
    const currentLastId = messages.length > 0 ? messages[messages.length - 1].id : lastKnownId;
    
    res.json({
        messages: newMessages,
        lastId: currentLastId
    });
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
        
        lastMessageId++;
        
        const newMessage = {
            id: lastMessageId,
            name,
            message,
            time: new Date().toISOString()
        };
        
        messages.push(newMessage);
        
        // Keep only the latest 100 messages
        if (messages.length > 100) {
            messages = messages.slice(-100);
        }
        
        // Save to file after update
        saveMessages();
        
        // Notify all waiting clients
        notifyNewMessages();
        
        res.json({ success: true, message: "Message received" });
    } catch (error) {
        console.error("Error handling message submission:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get all messages as JSON (keep for backward compatibility)
router.get("/", (req, res) => {
    try {
        res.json({ messages });
    } catch (error) {
        console.error("Error sending messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Long polling endpoint for message updates
router.get("/poll", (req, res) => {
    try {
        const lastId = parseInt(req.query.lastId || "0", 10);
        const newMessages = messages.filter(msg => msg.id > lastId);
        
        // If there are new messages, send them immediately
        if (newMessages.length > 0) {
            sendNewMessages(res, lastId);
        } else {
            // No new messages, set timeout to avoid hanging forever
            const timeoutId = setTimeout(() => {
                // Remove this connection from pending list
                pendingConnections = pendingConnections.filter(conn => conn.res !== res);
                sendNewMessages(res, lastId);
            }, 30000); // 30 second timeout
            
            // Store the connection for later notification
            pendingConnections.push({ 
                res, 
                lastId,
                timeoutId
            });
            
            // Handle client disconnect
            req.on('close', () => {
                clearTimeout(timeoutId);
                pendingConnections = pendingConnections.filter(conn => conn.res !== res);
            });
        }
    } catch (error) {
        console.error("Error in long polling:", error);
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
