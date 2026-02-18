module.exports = async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'playwright-dashboard',
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  });
};
