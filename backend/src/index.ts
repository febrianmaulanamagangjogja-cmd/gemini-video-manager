import { app } from './app.js';
import { config } from './config/index.js';
import { testConnection } from './database/db.js';

async function startServer() {
  const dbCheck = await testConnection();
  if (!dbCheck.success) {
    console.warn('⚠️ Warning: Could not connect to database on startup:', dbCheck.message);
  } else {
    console.log('✓ Database connection verified.');
  }

  // Start workers based on WORKER_MODE or DEMO_MODE
  const workerMode = process.env.WORKER_MODE || (config.demoMode ? 'demo' : 'browser');
  if (workerMode === 'demo') {
    // Only import and start demoWorker when in demo mode
    const { demoWorker } = await import('./services/demoWorker.js');
    demoWorker.start();
    console.log('[Worker] Started DemoWorker in demo mode');
  } else if (workerMode === 'browser') {
    console.log('[Worker] Starting Browser Worker mode...');
    try {
      const { browserWorker } = await import('./services/browserWorker.js');
      browserWorker.start();
    } catch (err: any) {
      console.error('[Worker] Failed to load BrowserWorker:', err);
    }
  } else {
    console.log('[Worker] Running in Standard Mode (Worker inactive).');
  }

  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv} | Demo Mode: ${config.demoMode}`);
    console.log(`Worker Mode: ${workerMode}`);
  });
}

startServer();
