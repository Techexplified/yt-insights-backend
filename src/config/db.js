const mongoose = require("mongoose");

// On Vercel every invocation may be a fresh or a reused function instance.
// Keeping the connection on `global` lets warm instances reuse it instead of
// opening a new connection on every request.
const cache = global._mongooseCache || (global._mongooseCache = { conn: null, promise: null });

const connectDB = async () => {
  if (cache.conn) return cache.conn;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGO_URI);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null; // allow a retry on the next request
    throw error;
  }

  return cache.conn;
};

module.exports = connectDB;
