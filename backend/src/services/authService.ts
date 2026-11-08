import bcrypt from 'bcryptjs';
import { pool } from '../database/db.js';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username harus diisi').max(100),
  password: z.string().min(1, 'Password harus diisi').max(255),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(100),
  password: z.string().min(8, 'Password minimal 8 karakter').max(255),
});

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
};

type SessionRow = {
  id: string;
  user_id: number;
  expires_at: Date;
  created_at: Date;
};

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'gv_session';

function generateSessionId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function findUserByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await pool.query(
    'SELECT * FROM `app_users` WHERE `username` = ?',
    [username]
  );
  const users = rows as UserRow[];
  return users.length > 0 ? users[0] : null;
}

async function findUserById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.query('SELECT * FROM `app_users` WHERE `id` = ?', [id]);
  const users = rows as UserRow[];
  return users.length > 0 ? users[0] : null;
}

async function createSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  
  await pool.execute(
    'INSERT INTO `app_sessions` (`id`, `user_id`, `expires_at`) VALUES (?, ?, ?)',
    [sessionId, userId, expiresAt]
  );
  
  return sessionId;
}

async function getSession(sessionId: string): Promise<{ session: SessionRow; user: UserRow } | null> {
  const [rows] = await pool.query(
    `SELECT s.*, u.id as user_id, u.username, u.password_hash, u.role, u.avatar_url, u.created_at as user_created_at, u.updated_at as user_updated_at
     FROM \`app_sessions\` s
     JOIN \`app_users\` u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [sessionId]
  );
  const sessions = rows as any[];
  if (sessions.length === 0) return null;
  
  const s = sessions[0];
  return {
    session: {
      id: s.id,
      user_id: s.user_id,
      expires_at: s.expires_at,
      created_at: s.created_at,
    },
    user: {
      id: s.user_id,
      username: s.username,
      password_hash: s.password_hash,
      role: s.role,
      is_active: s.is_active,
      avatar_url: s.avatar_url,
      created_at: s.user_created_at,
      updated_at: s.user_updated_at,
    },
  };
}

async function deleteSession(sessionId: string): Promise<void> {
  await pool.execute('DELETE FROM `app_sessions` WHERE `id` = ?', [sessionId]);
}

async function deleteUserSessions(userId: number): Promise<void> {
  await pool.execute('DELETE FROM `app_sessions` WHERE `user_id` = ?', [userId]);
}

async function cleanupExpiredSessions(): Promise<void> {
  await pool.execute('DELETE FROM `app_sessions` WHERE `expires_at` <= NOW()');
}

async function extendSession(sessionId: string): Promise<void> {
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.execute(
    'UPDATE `app_sessions` SET `expires_at` = ? WHERE `id` = ?',
    [newExpiresAt, sessionId]
  );
}

async function createUser(username: string, password: string, role: string = 'admin'): Promise<number> {
  const passwordHash = await hashPassword(password);
  const [result] = await pool.execute(
    'INSERT INTO `app_users` (`username`, `password_hash`, `role`) VALUES (?, ?, ?)',
    [username, passwordHash, role]
  );
  return (result as any).insertId;
}

async function userExists(username: string): Promise<boolean> {
  const [rows] = await pool.query('SELECT 1 FROM `app_users` WHERE `username` = ?', [username]);
  return (rows as any[]).length > 0;
}

async function getUserCount(): Promise<number> {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM `app_users`');
  return (rows as any[])[0].count;
}

export const authService = {
  loginSchema,
  registerSchema,
  hashPassword,
  verifyPassword,
  findUserByUsername,
  findUserById,
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  cleanupExpiredSessions,
  extendSession,
  createUser,
  userExists,
  getUserCount,
  SESSION_TTL_MS,
  COOKIE_NAME,
};