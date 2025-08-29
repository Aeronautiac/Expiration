require('dotenv').config();
const mongoose = require('mongoose');

const connectionString = process.env.MONGODB_URI;

function connectMongoose() {
    if (!connectionString) {
        throw new Error('MONGODB_URI is not set in environment variables.');
    }
    mongoose.connect(connectionString);

    mongoose.connection.on('connected', () => {
        console.log('[Mongoose] Connected to MongoDB.');
    });

    mongoose.connection.on('error', (err) => {
        console.error('[Mongoose] Connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('[Mongoose] Disconnected from MongoDB.');
    });

    mongoose.connection.on('reconnected', () => {
        console.log('[Mongoose] Reconnected to MongoDB.');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('[Mongoose] Connection closed due to app termination.');
        process.exit(0);
    });
}

function isConnected() {
    return mongoose.connection.readyState === 1;
}

async function disconnectMongoose() {
    await mongoose.connection.close();
    console.log('[Mongoose] Connection closed manually.');
}

module.exports = {
    mongoose,
    connectMongoose,
    isConnected,
    disconnectMongoose,
};