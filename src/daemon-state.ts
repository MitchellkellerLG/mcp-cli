/**
 * MCP-CLI Daemon State - PID and socket file management
 *
 * Encapsulates all file-system state for daemon processes.
 * Both daemon.ts (writer) and daemon-client.ts (reader) import from here.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { getPidPath, getSocketPath } from './config.js';

// ============================================================================
// Types
// ============================================================================

export interface PidFileContent {
  pid: number;
  configHash: string;
  startedAt: string;
}

// ============================================================================
// PID File Management
// ============================================================================

/**
 * Write PID file with config hash for stale detection
 */
export function writePidFile(serverName: string, configHash: string): void {
  const pidPath = getPidPath(serverName);
  const dir = dirname(pidPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const content: PidFileContent = {
    pid: process.pid,
    configHash,
    startedAt: new Date().toISOString(),
  };

  writeFileSync(pidPath, JSON.stringify(content), { mode: 0o600 });
}

/**
 * Read PID file content
 */
export function readPidFile(serverName: string): PidFileContent | null {
  const pidPath = getPidPath(serverName);

  if (!existsSync(pidPath)) {
    return null;
  }

  try {
    const content = readFileSync(pidPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Remove PID file
 */
export function removePidFile(serverName: string): void {
  const pidPath = getPidPath(serverName);
  try {
    if (existsSync(pidPath)) {
      unlinkSync(pidPath);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Remove socket file
 */
export function removeSocketFile(serverName: string): void {
  const socketPath = getSocketPath(serverName);
  try {
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Check if a process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a process by PID
 */
export function killProcess(pid: number): boolean {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}
