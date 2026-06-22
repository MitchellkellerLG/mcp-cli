/**
 * Tests for errors.ts and client.ts core logic
 *
 * Covers:
 * 1. CliError structured format and formatCliError output
 * 2. Error factory functions (config, server, tool, argument errors)
 * 3. isTransientError — the retry policy gate
 */

import { describe, test, expect } from 'bun:test';
import {
  ErrorCode,
  formatCliError,
  configNotFoundError,
  configSearchError,
  configInvalidJsonError,
  configMissingFieldError,
  serverNotFoundError,
  serverConnectionError,
  toolNotFoundError,
  toolExecutionError,
  toolDisabledError,
  invalidTargetError,
  invalidJsonArgsError,
  unknownOptionError,
  missingArgumentError,
  ambiguousCommandError,
  unknownSubcommandError,
  tooManyArgumentsError,
} from '../src/errors.js';
import { isTransientError } from '../src/client.js';

// ============================================================================
// formatCliError
// ============================================================================

describe('formatCliError', () => {
  test('formats error with type and message', () => {
    const err = {
      code: ErrorCode.CLIENT_ERROR,
      type: 'TEST_ERROR',
      message: 'Something went wrong',
    };
    const output = formatCliError(err);
    expect(output).toContain('Error [TEST_ERROR]');
    expect(output).toContain('Something went wrong');
  });

  test('includes details when present', () => {
    const err = {
      code: ErrorCode.CLIENT_ERROR,
      type: 'TEST_ERROR',
      message: 'Failed',
      details: 'More context here',
    };
    const output = formatCliError(err);
    expect(output).toContain('Details: More context here');
  });

  test('includes suggestion when present', () => {
    const err = {
      code: ErrorCode.CLIENT_ERROR,
      type: 'TEST_ERROR',
      message: 'Failed',
      suggestion: 'Try this instead',
    };
    const output = formatCliError(err);
    expect(output).toContain('Suggestion: Try this instead');
  });

  test('omits details and suggestion lines when absent', () => {
    const err = {
      code: ErrorCode.CLIENT_ERROR,
      type: 'TEST_ERROR',
      message: 'Minimal error',
    };
    const output = formatCliError(err);
    expect(output).not.toContain('Details:');
    expect(output).not.toContain('Suggestion:');
  });
});

// ============================================================================
// Config error factories
// ============================================================================

describe('configNotFoundError', () => {
  test('contains the path in the message', () => {
    const err = configNotFoundError('/tmp/missing.json');
    expect(err.type).toBe('CONFIG_NOT_FOUND');
    expect(err.code).toBe(ErrorCode.CLIENT_ERROR);
    expect(err.message).toContain('/tmp/missing.json');
    expect(err.suggestion).toBeTruthy();
  });
});

describe('configSearchError', () => {
  test('describes all searched paths', () => {
    const err = configSearchError();
    expect(err.type).toBe('CONFIG_NOT_FOUND');
    expect(err.details).toContain('mcp_servers.json');
  });
});

describe('configInvalidJsonError', () => {
  test('includes path and parse error', () => {
    const err = configInvalidJsonError('/path/to/config.json', 'Unexpected token');
    expect(err.type).toBe('CONFIG_INVALID_JSON');
    expect(err.message).toContain('/path/to/config.json');
    expect(err.details).toContain('Unexpected token');
  });
});

describe('configMissingFieldError', () => {
  test('references mcpServers field', () => {
    const err = configMissingFieldError('/path/to/config.json');
    expect(err.type).toBe('CONFIG_MISSING_FIELD');
    expect(err.message).toContain('mcpServers');
  });
});

// ============================================================================
// Server error factories
// ============================================================================

describe('serverNotFoundError', () => {
  test('lists available servers in details', () => {
    const err = serverNotFoundError('missing-server', ['server-a', 'server-b']);
    expect(err.type).toBe('SERVER_NOT_FOUND');
    expect(err.message).toContain('missing-server');
    expect(err.details).toContain('server-a');
    expect(err.details).toContain('server-b');
  });

  test('handles empty available list', () => {
    const err = serverNotFoundError('missing-server', []);
    expect(err.details).toContain('(none)');
  });
});

describe('serverConnectionError', () => {
  test('detects ENOENT and gives install suggestion', () => {
    const err = serverConnectionError('my-server', 'ENOENT: command not found');
    expect(err.type).toBe('SERVER_CONNECTION_FAILED');
    expect(err.suggestion).toContain('Install');
  });

  test('detects ECONNREFUSED and gives connection suggestion', () => {
    const err = serverConnectionError('my-server', 'ECONNREFUSED');
    expect(err.suggestion).toContain('running');
  });

  test('detects timeout and gives network suggestion', () => {
    const err = serverConnectionError('my-server', 'connection timeout');
    expect(err.suggestion).toContain('network');
  });
});

// ============================================================================
// Tool error factories
// ============================================================================

describe('toolNotFoundError', () => {
  test('includes tool and server names', () => {
    const err = toolNotFoundError('my_tool', 'my_server', ['a', 'b', 'c']);
    expect(err.type).toBe('TOOL_NOT_FOUND');
    expect(err.message).toContain('my_tool');
    expect(err.message).toContain('my_server');
  });

  test('truncates available tools at 5 with count', () => {
    const manyTools = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
    const err = toolNotFoundError('missing', 'server', manyTools);
    expect(err.details).toContain('+2 more');
  });
});

describe('toolDisabledError', () => {
  test('mentions allowedTools/disabledTools in details', () => {
    const err = toolDisabledError('delete_file', 'filesystem');
    expect(err.type).toBe('TOOL_DISABLED');
    expect(err.details).toContain('allowedTools');
  });
});

// ============================================================================
// Argument error factories
// ============================================================================

describe('invalidTargetError', () => {
  test('shows the invalid target in the message', () => {
    const err = invalidTargetError('badformat');
    expect(err.type).toBe('INVALID_TARGET');
    expect(err.message).toContain('badformat');
  });
});

describe('invalidJsonArgsError', () => {
  test('shows parse error in details when provided', () => {
    const err = invalidJsonArgsError('{}bad', 'Unexpected token');
    expect(err.details).toContain('Unexpected token');
  });

  test('truncates long input when no parse error provided', () => {
    // When parseError is omitted, details shows the raw input truncated at 100 chars
    const longInput = 'x'.repeat(150);
    const err = invalidJsonArgsError(longInput);
    expect(err.details).toContain('...');
  });

  test('error type is INVALID_JSON_ARGUMENTS', () => {
    const err = invalidJsonArgsError('bad input', 'Some error');
    expect(err.type).toBe('INVALID_JSON_ARGUMENTS');
    expect(err.code).toBe(ErrorCode.CLIENT_ERROR);
  });
});

describe('ambiguousCommandError', () => {
  test('suggests both call and info forms', () => {
    const err = ambiguousCommandError('filesystem', 'read_file', false);
    expect(err.type).toBe('AMBIGUOUS_COMMAND');
    expect(err.suggestion).toContain('call');
    expect(err.suggestion).toContain('info');
  });

  test('includes <json> hint when hasArgs is true', () => {
    const err = ambiguousCommandError('server', 'tool', true);
    expect(err.suggestion).toContain('<json>');
  });
});

describe('unknownSubcommandError', () => {
  test('suggests call for run alias', () => {
    const err = unknownSubcommandError('run');
    expect(err.type).toBe('UNKNOWN_SUBCOMMAND');
    expect(err.suggestion).toContain('call');
  });

  test('suggests info for list alias', () => {
    const err = unknownSubcommandError('list');
    expect(err.suggestion).toContain('info');
  });

  test('falls back to --help for unknown aliases', () => {
    const err = unknownSubcommandError('unknowncommand');
    expect(err.suggestion).toContain('--help');
  });
});

describe('tooManyArgumentsError', () => {
  test('includes received and max counts', () => {
    const err = tooManyArgumentsError('grep', 3, 1);
    expect(err.type).toBe('TOO_MANY_ARGUMENTS');
    expect(err.details).toContain('3');
    expect(err.details).toContain('1');
  });
});

// ============================================================================
// isTransientError — retry policy gate
// ============================================================================

describe('isTransientError', () => {
  function makeError(message: string, code?: string): Error {
    const err = new Error(message);
    if (code) (err as NodeJS.ErrnoException).code = code;
    return err;
  }

  test('ECONNREFUSED is transient', () => {
    expect(isTransientError(makeError('connection refused', 'ECONNREFUSED'))).toBe(true);
  });

  test('ETIMEDOUT is transient', () => {
    expect(isTransientError(makeError('timed out', 'ETIMEDOUT'))).toBe(true);
  });

  test('ECONNRESET is transient', () => {
    expect(isTransientError(makeError('reset', 'ECONNRESET'))).toBe(true);
  });

  test('EPIPE is transient', () => {
    expect(isTransientError(makeError('broken pipe', 'EPIPE'))).toBe(true);
  });

  test('HTTP 502 in message is transient', () => {
    expect(isTransientError(makeError('502 Bad Gateway'))).toBe(true);
  });

  test('HTTP 503 in message is transient', () => {
    expect(isTransientError(makeError('503 Service Unavailable'))).toBe(true);
  });

  test('HTTP 429 in message is transient', () => {
    expect(isTransientError(makeError('429 Too Many Requests'))).toBe(true);
  });

  test('connection timeout in message is transient', () => {
    expect(isTransientError(makeError('connection timeout'))).toBe(true);
  });

  test('network error in message is transient', () => {
    expect(isTransientError(makeError('network error occurred'))).toBe(true);
  });

  test('ENOENT is NOT transient', () => {
    expect(isTransientError(makeError('no such file', 'ENOENT'))).toBe(false);
  });

  test('401 Unauthorized is NOT transient', () => {
    expect(isTransientError(makeError('401 Unauthorized'))).toBe(false);
  });

  test('invalid JSON error is NOT transient', () => {
    expect(isTransientError(makeError('Invalid JSON in arguments'))).toBe(false);
  });

  test('generic Error is NOT transient', () => {
    expect(isTransientError(makeError('Tool not found'))).toBe(false);
  });
});
