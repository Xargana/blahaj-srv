const admin = require('firebase-admin');
const path = require('path');

// Get path to service account file
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

// Log the path to verify
console.log(`Loading Firebase service account from: ${serviceAccountPath}`);

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    console.log("Firebase Admin SDK initialized successfully");
    
    // Function to send FCM notification
    async function sendTestNotification() {
        try {
            // Send to both topics to test both scenarios
            const topics = ['service_online', 'service_offline'];
            
            for (const topic of topics) {
                // Correctly format the message for Firebase Cloud Messaging
                const message = {
                    topic: topic,
                    notification: {
                        title: 'Test Notification',
                        body: `This is a test notification to the ${topic} topic`
                    },
                    data: {
                        type: 'test',
                        timestamp: Date.now().toString()
                    }
                };
                
                console.log(`Sending test notification to topic: ${topic}`);
                // Use the send method instead of sendToTopic
                const response = await admin.messaging().send(message);
                console.log(`Successfully sent message to ${topic}:`, response);
            }
            
            console.log("All test notifications sent successfully!");
            process.exit(0);
        } catch (error) {
            console.error('Error sending notification:', error);
            process.exit(1);
        }
    }
    
    // Execute the test
    sendTestNotification();
    
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    console.error("Make sure firebase-service-account.json exists in the repository root");
    process.exit(1);
}
