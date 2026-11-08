import express from 'express';
import { getAllSettings, getSetting, updateSettings, initializeSettings } from '../services/settingsService.js';

const router = express.Router();

// GET /api/settings - Get all system settings
router.get('/', async (_req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({ success: true, data: settings });
  } catch (err: any) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch settings' });
  }
});

// GET /api/settings/:key - Get a single setting
router.get('/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const validKeys = ['autoRetry', 'maxRetries', 'downloadTimeout', 'cacheCleanInterval', 'validateVideoIntegrity', 'websiteName', 'websiteIcon'];
    if (!validKeys.includes(key)) {
      res.status(400).json({ success: false, error: 'Invalid setting key' });
      return;
    }
    const value = await getSetting(key as any);
    res.json({ success: true, key, value });
  } catch (err: any) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch setting' });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate keys
    const validKeys = ['autoRetry', 'maxRetries', 'downloadTimeout', 'cacheCleanInterval', 'validateVideoIntegrity', 'websiteName', 'websiteIcon'];
    const keys = Object.keys(updates);
    for (const key of keys) {
      if (!validKeys.includes(key)) {
        res.status(400).json({ success: false, error: `Invalid setting key: ${key}` });
        return;
      }
    }
    
    // Type validation
    if (updates.autoRetry !== undefined && typeof updates.autoRetry !== 'boolean') {
      res.status(400).json({ success: false, error: 'autoRetry must be boolean' });
      return;
    }
    if (updates.maxRetries !== undefined && typeof updates.maxRetries !== 'number') {
      res.status(400).json({ success: false, error: 'maxRetries must be number' });
      return;
    }
    if (updates.downloadTimeout !== undefined && typeof updates.downloadTimeout !== 'number') {
      res.status(400).json({ success: false, error: 'downloadTimeout must be number' });
      return;
    }
    if (updates.cacheCleanInterval !== undefined && typeof updates.cacheCleanInterval !== 'number') {
      res.status(400).json({ success: false, error: 'cacheCleanInterval must be number' });
      return;
    }
    if (updates.validateVideoIntegrity !== undefined && typeof updates.validateVideoIntegrity !== 'boolean') {
      res.status(400).json({ success: false, error: 'validateVideoIntegrity must be boolean' });
      return;
    }
    if (updates.websiteName !== undefined && typeof updates.websiteName !== 'string') {
      res.status(400).json({ success: false, error: 'websiteName must be string' });
      return;
    }
    if (updates.websiteIcon !== undefined && typeof updates.websiteIcon !== 'string') {
      res.status(400).json({ success: false, error: 'websiteIcon must be string' });
      return;
    }
    
    const settings = await updateSettings(updates);
    res.json({ success: true, data: settings });
  } catch (err: any) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update settings' });
  }
});

// POST /api/settings/initialize - Initialize default settings
router.post('/initialize', async (_req, res) => {
  try {
    await initializeSettings();
    res.json({ success: true, message: 'Settings initialized' });
  } catch (err: any) {
    console.error('Error initializing settings:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to initialize settings' });
  }
});

// PUT /api/settings/user - Update user-specific settings
router.put('/user', async (req: express.Request, res: express.Response) => {
  try {
    const updates = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    // Validate keys
    const validKeys = ['autoRetry', 'maxRetries', 'downloadTimeout', 'cacheCleanInterval', 'validateVideoIntegrity'];
    const keys = Object.keys(updates);
    for (const key of keys) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ success: false, error: `Invalid setting key: ${key}` });
      }
    }
    
    // Type validation
    if (updates.autoRetry !== undefined && typeof updates.autoRetry !== 'boolean') {
      return res.status(400).json({ success: false, error: 'autoRetry must be boolean' });
    }
    if (updates.maxRetries !== undefined && typeof updates.maxRetries !== 'number') {
      return res.status(400).json({ success: false, error: 'maxRetries must be number' });
    }
    if (updates.downloadTimeout !== undefined && typeof updates.downloadTimeout !== 'number') {
      return res.status(400).json({ success: false, error: 'downloadTimeout must be number' });
    }
    if (updates.cacheCleanInterval !== undefined && typeof updates.cacheCleanInterval !== 'number') {
      return res.status(400).json({ success: false, error: 'cacheCleanInterval must be number' });
    }
    if (updates.validateVideoIntegrity !== undefined && typeof updates.validateVideoIntegrity !== 'boolean') {
      return res.status(400).json({ success: false, error: 'validateVideoIntegrity must be boolean' });
    }
    
    // Update settings
    const settings = await updateSettings(updates, userId);
    res.json({ success: true, data: settings });
  } catch (err: any) {
    console.error('Error updating user settings:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update settings' });
  }
});

export default router;