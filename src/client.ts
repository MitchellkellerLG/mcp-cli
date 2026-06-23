/**
 * MCP Client - Connection management for MCP servers
 *
 * Public API: getConnection(), safeClose(), McpConnection, ToolInfo, isTransientError
 *
 * Transport primitives (connectToServer, listTools, callTool, ConnectedClient)
 * are intentionally NOT exported here. Use getConnection() to get the filtering layer.
 * daemon.ts imports them directly from transport.ts because it is the server-side
 * of the daemon IPC, not an external caller.
 */

import {
  type ServerConfig,
  debug,
  filterTools,
  getConcurrencyLimit,
  getTimeoutMs,
  isDaemonEnabled,
  isToolAllowed,
} from './config.js';
import {
  type DaemonConnection,
  cleanupOrphanedDaemons,
  getDaemonConnection,
} from './daemon-client.js';
import {
  type ConnectedClient,
  type ToolInfo,
  callTool,
  connectToServer,
  isTransientError,
  listTools,
} from './transport.js';

// Re-export config utilities for convenience
export { debug, getTimeoutMs, getConcurrencyLimit };

// Re-export isTransientError (used by tests and retry logic)
export { isTransientError };

// Re-export ToolInfo (used by commands and output module)
export type { ToolInfo };

/**
 * Unified connection interface that works with both daemon and direct connections
 */
export interface McpConnection {
  listTools: () => Promise<ToolInfo[]>;
  callTool: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  getInstructions: () => Promise<string | undefined>;
  close: () => Promise<void>;
  isDaemon: boolean;
}

export interface ServerInfo {
  name: string;
  version?: string;
  protocolVersion?: string;
}

/**
 * Safely close a connection, logging but not throwing on error
 */
export async function safeClose(close: () => Promise<void>): Promise<void> {
  try {
    await close();
  } catch (err) {
    debug(`Failed to close connection: ${(err as Error).message}`);
  }
}

// ============================================================================
// Unified Connection Interface (Daemon + Direct)
// ============================================================================

/**
 * Get a unified connection to an MCP server
 *
 * If daemon mode is enabled (default), tries to use a cached daemon connection.
 * Falls back to direct connection if daemon fails or is disabled.
 *
 * All connections go through the filtering layer (filterTools / isToolAllowed).
 * External callers MUST use this function — never connectToServer directly.
 *
 * @param serverName - Name of the server from config
 * @param config - Server configuration
 * @returns McpConnection with listTools, callTool, and close methods
 */
export async function getConnection(
  serverName: string,
  config: ServerConfig,
): Promise<McpConnection> {
  // Clean up any orphaned daemons on first call
  await cleanupOrphanedDaemons();

  // Try daemon connection if enabled
  if (isDaemonEnabled()) {
    try {
      const daemonConn = await getDaemonConnection(serverName, config);
      if (daemonConn) {
        debug(`Using daemon connection for ${serverName}`);
        return {
          async listTools(): Promise<ToolInfo[]> {
            const data = await daemonConn.listTools();
            const tools = data as ToolInfo[];
            // Apply tool filtering from config
            return filterTools(tools, config);
          },
          async callTool(
            toolName: string,
            args: Record<string, unknown>,
          ): Promise<unknown> {
            // Check if tool is allowed before calling
            if (!isToolAllowed(toolName, config)) {
              throw new Error(
                `Tool "${toolName}" is disabled by configuration`,
              );
            }
            return daemonConn.callTool(toolName, args);
          },
          async getInstructions(): Promise<string | undefined> {
            return daemonConn.getInstructions();
          },
          async close(): Promise<void> {
            await daemonConn.close();
          },
          isDaemon: true,
        };
      }
    } catch (err) {
      debug(
        `Daemon connection failed for ${serverName}: ${(err as Error).message}, falling back to direct`,
      );
    }
  }

  // Fall back to direct connection
  debug(`Using direct connection for ${serverName}`);
  const { client, close } = await connectToServer(serverName, config);

  return {
    async listTools(): Promise<ToolInfo[]> {
      const tools = await listTools(client);
      // Apply tool filtering from config
      return filterTools(tools, config);
    },
    async callTool(
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<unknown> {
      // Check if tool is allowed before calling
      if (!isToolAllowed(toolName, config)) {
        throw new Error(`Tool "${toolName}" is disabled by configuration`);
      }
      return callTool(client, toolName, args);
    },
    async getInstructions(): Promise<string | undefined> {
      return client.getInstructions();
    },
    async close(): Promise<void> {
      await close();
    },
    isDaemon: false,
  };
}
