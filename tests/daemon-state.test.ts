/**
 * Tests for Issue #23: daemon PID file functions leak
 *
 * RED: PID management lives in daemon.ts and is imported by daemon-client.ts directly.
 * GREEN: PID management must live in daemon-state.ts; daemon-client.ts must import from there.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dir, '..', 'src');

describe('Issue #23: PID file management encapsulated in daemon-state.ts', () => {
  test('daemon-state.ts exports the PID file functions', async () => {
    // Will throw if the file does not exist
    const mod = await import('../src/daemon-state.js');

    expect(typeof mod.writePidFile).toBe('function');
    expect(typeof mod.readPidFile).toBe('function');
    expect(typeof mod.removePidFile).toBe('function');
    expect(typeof mod.removeSocketFile).toBe('function');
    expect(typeof mod.isProcessRunning).toBe('function');
    expect(typeof mod.killProcess).toBe('function');
  });

  test('daemon.ts does NOT export PID file functions directly', async () => {
    const mod = await import('../src/daemon.js');

    // These should no longer be exported from daemon.ts
    expect((mod as Record<string, unknown>).writePidFile).toBeUndefined();
    expect((mod as Record<string, unknown>).readPidFile).toBeUndefined();
    expect((mod as Record<string, unknown>).removePidFile).toBeUndefined();
    expect((mod as Record<string, unknown>).removeSocketFile).toBeUndefined();
    expect((mod as Record<string, unknown>).isProcessRunning).toBeUndefined();
    expect((mod as Record<string, unknown>).killProcess).toBeUndefined();
  });

  test('daemon-client.ts imports PID functions from daemon-state, not daemon', () => {
    const source = readFileSync(join(SRC, 'daemon-client.ts'), 'utf-8');

    // Must NOT import these functions from daemon
    expect(source).not.toMatch(/from ['"]\.\/daemon\.js['"]\s*;?\s*\/\/.*pid/i);

    const importFromDaemon = source.match(/from ['"]\.\/daemon\.js['"]/g) ?? [];
    // Any import from daemon.js should not include PID-related names
    const pidNames = [
      'writePidFile',
      'readPidFile',
      'removePidFile',
      'removeSocketFile',
      'isProcessRunning',
      'killProcess',
    ];
    for (const name of pidNames) {
      // Check that name is not imported from daemon.js
      // We find the import block(s) from daemon.js and check the names
      const daemonImportBlock = source.match(
        /import\s*\{[^}]*\}\s*from\s*['"]\.\/daemon\.js['"]/gs,
      );
      if (daemonImportBlock) {
        for (const block of daemonImportBlock) {
          expect(block).not.toContain(name);
        }
      }
    }

    // Must import from daemon-state.js
    expect(source).toMatch(/from ['"]\.\/daemon-state\.js['"]/);
  });

  test('writePidFile writes a readable PID file', async () => {
    const { writePidFile, readPidFile, removePidFile } = await import(
      '../src/daemon-state.js'
    );

    const serverName = `test-pid-${Date.now()}`;
    const hash = 'abc123';

    writePidFile(serverName, hash);
    const info = readPidFile(serverName);

    expect(info).not.toBeNull();
    expect(info?.pid).toBe(process.pid);
    expect(info?.configHash).toBe(hash);
    expect(typeof info?.startedAt).toBe('string');

    // Cleanup
    removePidFile(serverName);
    expect(readPidFile(serverName)).toBeNull();
  });

  test('isProcessRunning detects current process', async () => {
    const { isProcessRunning } = await import('../src/daemon-state.js');
    expect(isProcessRunning(process.pid)).toBe(true);
  });

  test('isProcessRunning returns false for dead PID', async () => {
    const { isProcessRunning } = await import('../src/daemon-state.js');
    // PID 999999999 is virtually guaranteed to not exist
    expect(isProcessRunning(999999999)).toBe(false);
  });
});
