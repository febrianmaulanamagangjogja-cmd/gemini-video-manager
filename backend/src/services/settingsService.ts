import { pool } from '../database/db.js';
import type { RowDataPacket } from 'mysql2';

export interface SystemSettings {
  autoRetry: boolean;
  maxRetries: number;
  downloadTimeout: number; // in minutes
  cacheCleanInterval: number; // in minutes
  validateVideoIntegrity: boolean;
  websiteName: string;
  websiteIcon: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  autoRetry: false,
  maxRetries: 3,
  downloadTimeout: 30,
  cacheCleanInterval: 60,
  validateVideoIntegrity: true,
  websiteName: 'Gemini Video Manager',
  websiteIcon: '',
};

const SETTINGS_KEYS: (keyof SystemSettings)[] = [
  'autoRetry',
  'maxRetries',
  'downloadTimeout',
  'cacheCleanInterval',
  'validateVideoIntegrity',
  'websiteName',
  'websiteIcon',
];

function dbKeyToCamel(key: string): keyof SystemSettings {
  const mapping: Record<string, keyof SystemSettings> = {
    'auto_retry': 'autoRetry',
    'max_retries': 'maxRetries',
    'download_timeout': 'downloadTimeout',
    'cache_clean_interval': 'cacheCleanInterval',
    'validate_video_integrity': 'validateVideoIntegrity',
    'website_name': 'websiteName',
    'website_icon': 'websiteIcon',
  };
  return mapping[key] || (key as keyof SystemSettings);
}

function camelToDbKey(key: keyof SystemSettings): string {
  const mapping: Record<keyof SystemSettings, string> = {
    'autoRetry': 'auto_retry',
    'maxRetries': 'max_retries',
    'downloadTimeout': 'download_timeout',
    'cacheCleanInterval': 'cache_clean_interval',
    'validateVideoIntegrity': 'validate_video_integrity',
    'websiteName': 'website_name',
    'websiteIcon': 'website_icon',
  };
  return mapping[key];
}

function parseValue(key: keyof SystemSettings, value: string): SystemSettings[keyof SystemSettings] {
  if (key === 'autoRetry' || key === 'validateVideoIntegrity') {
    return value === 'true';
  }
  if (key === 'maxRetries' || key === 'downloadTimeout' || key === 'cacheCleanInterval') {
    return parseInt(value, 10);
  }
  // websiteName and websiteIcon are strings, just return as is
  return value as any;
}

function serializeValue(value: SystemSettings[keyof SystemSettings]): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

export async function getAllSettings(): Promise<SystemSettings> {
  const [rows] = await pool.query<(RowDataPacket & { key: string; value: string })[]>(
    'SELECT `key`, `value` FROM `system_settings`'
  );
  
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const camelKey = dbKeyToCamel(row.key);
    if (camelKey in settings) {
      (settings as any)[camelKey] = parseValue(camelKey, row.value);
    }
  }
  return settings;
}

export async function getSetting<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
  const [rows] = await pool.query<(RowDataPacket & { value: string })[]>(
    'SELECT `value` FROM `system_settings` WHERE `key` = ?',
    [camelToDbKey(key)]
  );
  if (rows.length === 0) {
    return DEFAULT_SETTINGS[key];
  }
  return parseValue(key, rows[0].value) as SystemSettings[K];
}

export async function updateSettings(partial: Partial<SystemSettings>, userId?: number): Promise<SystemSettings> {
  const updates: string[] = [];
  const values: string[] = [];
  
  for (const [key, value] of Object.entries(partial)) {
    const dbKey = camelToDbKey(key as keyof SystemSettings);
    updates.push(`${dbKey} = ?`);
    values.push(serializeValue(value as SystemSettings[keyof SystemSettings]));
  }

  if (updates.length > 0) {
    if (userId !== undefined) {
      // Per-user settings stored in user_settings table
      const setClause = updates.join(', ');
      const setValues = values.map(() => '?');
      await pool.query(
        `INSERT INTO \`user_settings\` (user_id, ${updates.map(() => '?').join(', ')}, updated_at) VALUES (${setValues.map(() => '?').join(', ')}, NOW()) ON DUPLICATE KEY UPDATE ${setClause}`,
        [...values, ...setValues.map(() => userId), ...updates.map(() => userId)]
      );
    } else {
      // Global system settings stored in system_settings table
      for (let i = 0; i < updates.length; i++) {
        const dbKey = camelToDbKey(Object.keys(partial)[i] as keyof SystemSettings);
        await pool.query(
          'INSERT INTO `system_settings` (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          [dbKey, values[i], values[i]]
        );
      }
    }
  }

  if (userId !== undefined) {
    // Return per-user settings
    const [rows] = await pool.query<(RowDataPacket & { key: string; value: string })[]>(
      'SELECT `auto_retry`, `max_retries`, `download_timeout`, `cache_clean_interval`, `validate_video_integrity` FROM `user_settings` WHERE `user_id` = ?',
      [userId]
    );
    if (rows.length > 0) {
      return {
        ...DEFAULT_SETTINGS,
        ...rows[0],
      } as any;
    }
    return DEFAULT_SETTINGS;
  }

  return getAllSettings();
}

export async function initializeSettings(): Promise<void> {
  // Ensure all default settings exist in database
  for (const key of SETTINGS_KEYS) {
    const dbKey = camelToDbKey(key);
    const [rows] = await pool.query<(RowDataPacket & { key: string })[]>(
      'SELECT `key` FROM `system_settings` WHERE `key` = ?',
      [dbKey]
    );
    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO `system_settings` (`key`, `value`) VALUES (?, ?)',
        [dbKey, serializeValue(DEFAULT_SETTINGS[key])]
      );
    }
  }
}