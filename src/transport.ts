/**
 * MCP Transport Primitives — internal module
 *
 * Direct connection management without the filtering layer.
 * Used by:
 *   - client.ts (inside getConnection's fallback path)
 *   - daemon.ts (daemon subprocess holds the raw connection server-side)
 *
 * External command modules MUST NOT import from this file.
 * They must use getConnection() from client.ts to get the filtering layer.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  type HttpServerConfig,
  type ServerConfig,
  type StdioServerConfig,
  debug,
  getMaxRetries,
  getRetryDelayMs,
  getTimeoutMs,
  isHttpServer,
} from './config.js';
import { VERSION } from './version.js';

// ============================================================================
// Types
// ============================================================================

export interface ConnectedClient {
  client: Client;
  close: () => Promise<void>;
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// Retry logic
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  totalBudgetMs: number;
}

function getRetryConfig(): RetryConfig {
  const totalBudgetMs = getTimeoutMs();
  const maxRetries = getMaxRetries();
  const baseDelayMs = getRetryDelayMs();
  const retryBudgetMs = Math.max(0, totalBudgetMs - 5000);
  return {
    maxRetries,
    baseDelayMs,
    maxDelayMs: Math.min(10000, retryBudgetMs / 2),
    totalBudgetMs,
  };
}

/**
 * Check if an error is transient and worth retrying
 */
export function isTransientError(error: Error): boolean {
  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError.code) {
    const transientCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EPIPE',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'EAI_AGAIN',
    ];
    if (transientCodes.includes(nodeError.code)) {
      return true;
    }
  }

  const message = error.message;

  if (/^(502|503|504|429)\b/.test(message)) return true;
  if (/\b(http|status(\s+code)?)\s*(502|503|504|429)\b/i.test(message))
    return true;
  if (
    /\b(502|503|504|429)\s+(bad gateway|service unavailable|gateway timeout|too many requests)/i.test(
      message,
    )
  )
    return true;

  if (/network\s*(error|fail|unavailable|timeout)/i.test(message)) return true;
  if (/connection\s*(reset|refused|timeout)/i.test(message)) return true;
  if (/\btimeout\b/i.test(message)) return true;

  return false;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * 2 ** attempt;
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: RetryConfig = getRetryConfig(),
): Promise<T> {
  let lastError: Error | undefined;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= config.totalBudgetMs) {
      debug(`${operationName}: timeout budget exhausted after ${elapsed}ms`);
      break;
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const remainingBudget = config.totalBudgetMs - (Date.now() - startTime);
      const shouldRetry =
        attempt < config.maxRetries &&
        isTransientError(lastError) &&
        remainingBudget > 1000;

      if (shouldRetry) {
        const delay = Math.min(
          calculateDelay(attempt, config),
          remainingBudget - 1000,
        );
        debug(
          `${operationName} failed (attempt ${attempt + 1}/${config.maxRetries + 1}): ${lastError.message}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Transport creation
// ============================================================================

function createHttpTransport(
  config: HttpServerConfig,
): StreamableHTTPClientTransport {
  const url = new URL(config.url);
  return new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: config.headers,
    },
  });
}

function createStdioTransport(config: StdioServerConfig): StdioClientTransport {
  const mergedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      mergedEnv[key] = value;
    }
  }
  if (config.env) {
    Object.assign(mergedEnv, config.env);
  }

  return new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: mergedEnv,
    cwd: config.cwd,
    stderr: 'pipe',
  });
}

// ============================================================================
// Public primitives (for daemon.ts and client.ts internals)
// ============================================================================

/**
 * Connect to an MCP server with retry logic.
 * NOTE: This bypasses tool filtering. Use getConnection() from client.ts instead.
 */
export async function connectToServer(
  serverName: string,
  config: ServerConfig,
): Promise<ConnectedClient> {
  const stderrChunks: string[] = [];

  return withRetry(async () => {
    const client = new Client(
      { name: 'mcp-cli', version: VERSION },
      { capabilities: {} },
    );

    let transport: StdioClientTransport | StreamableHTTPClientTransport;

    if (isHttpServer(config)) {
      transport = createHttpTransport(config);
    } else {
      transport = createStdioTransport(config);

      const stderrStream = transport.stderr;
      if (stderrStream) {
        stderrStream.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          stderrChunks.push(text);
          process.stderr.write(`[${serverName}] ${text}`);
        });
      }
    }

    try {
      await client.connect(transport);
    } catch (error) {
      const stderrOutput = stderrChunks.join('').trim();
      if (stderrOutput) {
        const err = error as Error;
        err.message = `${err.message}\n\nServer stderr:\n${stderrOutput}`;
      }
      throw error;
    }

    if (!isHttpServer(config)) {
      const stderrStream = (transport as StdioClientTransport).stderr;
      if (stderrStream) {
        stderrStream.on('data', (chunk: Buffer) => {
          process.stderr.write(chunk);
        });
      }
    }

    return {
      client,
      close: async () => {
        await client.close();
      },
    };
  }, `connect to ${serverName}`);
}

/**
 * List all tools from a connected client with retry logic.
 * NOTE: No filtering applied. Use getConnection().listTools() from client.ts instead.
 */
export async function listTools(client: Client): Promise<ToolInfo[]> {
  return withRetry(async () => {
    const result = await client.listTools();
    return result.tools.map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }, 'list tools');
}

/**
 * Call a tool with arguments and retry logic.
 * NOTE: No filtering applied. Use getConnection().callTool() from client.ts instead.
 */
export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withRetry(async () => {
    const result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: getTimeoutMs() },
    );
    return result;
  }, `call tool ${toolName}`);
}
