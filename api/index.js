/**
 * Vercel serverless function entry point
 * Routes all API requests to the Express app
 */
const app = require('../backend/server');

module.exports = app;
