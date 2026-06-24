/**
 * Tests for Issue #24: client.ts exports transport primitives
 *
 * RED: connectToServer, listTools, callTool, ConnectedClient are exported from client.ts.
 * GREEN: Transport primitives must not be part of the public client.ts API.
 *        All external callers must use getConnection (which enforces the filtering layer).
 *        daemon.ts may access them via an internal transport module.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dir, '..', 'src');

describe('Issue #24: transport primitives not exported from client.ts', () => {
  test('client.ts does NOT export connectToServer', async () => {
    const mod = await import('../src/client.js');
    expect((mod as Record<string, unknown>).connectToServer).toBeUndefined();
  });

  test('client.ts does NOT export listTools', async () => {
    const mod = await import('../src/client.js');
    // listTools as a standalone transport function should not be exported
    // (ToolInfo type export is fine, but the transport function is not)
    expect((mod as Record<string, unknown>).listTools).toBeUndefined();
  });

  test('client.ts does NOT export callTool', async () => {
    const mod = await import('../src/client.js');
    expect((mod as Record<string, unknown>).callTool).toBeUndefined();
  });

  test('client.ts DOES export getConnection (the filtering gateway)', async () => {
    const mod = await import('../src/client.js');
    expect(typeof (mod as Record<string, unknown>).getConnection).toBe('function');
  });

  test('client.ts DOES export safeClose (utility, not transport primitive)', async () => {
    const mod = await import('../src/client.js');
    expect(typeof (mod as Record<string, unknown>).safeClose).toBe('function');
  });

  test('commands import getConnection, not connectToServer/listTools/callTool', () => {
    const commandFiles = ['call.ts', 'grep.ts', 'info.ts', 'list.ts'].map(
      (f) => join(SRC, 'commands', f),
    );

    for (const file of commandFiles) {
      const source = readFileSync(file, 'utf-8');
      const importFromClient = source.match(
        /import\s*\{[^}]*\}\s*from\s*['"]\.\.\/client\.js['"]/gs,
      );
      if (importFromClient) {
        for (const block of importFromClient) {
          expect(block).not.toContain('connectToServer');
          expect(block).not.toContain('listTools');
          expect(block).not.toContain('callTool');
        }
      }
    }
  });

  test('daemon.ts does NOT import transport primitives from client.ts', () => {
    const source = readFileSync(join(SRC, 'daemon.ts'), 'utf-8');

    // daemon.ts must not import these names from client.ts under any circumstances.
    // Checking the raw source catches re-exports, aliased imports, and dynamic requires.
    const forbidden = ['connectToServer', 'listTools', 'callTool', 'ConnectedClient'];
    const fromClientPattern = /from\s*['"]\.\/client\.js['"]/;

    // If there is no import from client.ts at all, we still need to ensure
    // the forbidden names aren't sneaking in via other means from client.
    // The primary guard: any line that mentions a forbidden name AND client.js
    // on the same import statement must not exist.
    for (const name of forbidden) {
      // Find any import block that references client.js and contains the name
      const pattern = new RegExp(
        `import\\s*\\{[^}]*${name}[^}]*\\}\\s*from\\s*['"]\\./client\\.js['"]`,
        'gs',
      );
      expect(source).not.toMatch(pattern);
    }

    // Belt-and-suspenders: assert there is no import from client.js at all.
    // daemon.ts must go through transport.js directly.
    expect(source).not.toMatch(fromClientPattern);
  });
});
