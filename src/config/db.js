const mongoose = require("mongoose");

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured.");
  }

  connectionPromise = mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const conn = await connectionPromise;
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    connectionPromise = null;
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;
