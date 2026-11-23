import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  tududuApiUrl: string;
  tududuApiKey?: string;
  tududuEmail?: string;
  tududuPassword?: string;
  logLevel: string;
  transport: 'stdio' | 'http';
  port: number;
  mcpAuthToken?: string;
}

/**
 * Strip trailing slashes and an optional /api or /api/vN suffix so endpoint
 * paths can consistently use /api/v1/... without path duplication.
 */
export function normalizeTududiApiUrl(apiUrl: string): string {
  return apiUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(?:\/v\d+)?$/i, '');
}

export function getConfig(): Config {
  const rawApiUrl = process.env.TUDUDI_API_URL?.trim();
  const tududuApiKey = process.env.TUDUDI_API_KEY?.trim() || undefined;
  const tududuEmail = process.env.TUDUDI_EMAIL?.trim() || undefined;
  const tududuPassword = process.env.TUDUDI_PASSWORD || undefined;

  if (!rawApiUrl) {
    throw new Error('TUDUDI_API_URL environment variable is required');
  }

  const tududuApiUrl = normalizeTududiApiUrl(rawApiUrl);
  if (!tududuApiUrl) {
    throw new Error('TUDUDI_API_URL environment variable is invalid');
  }

  // Support either API key OR email/password authentication
  if (!tududuApiKey && (!tududuEmail || !tududuPassword)) {
    throw new Error(
      'Either TUDUDI_API_KEY or both TUDUDI_EMAIL and TUDUDI_PASSWORD environment variables are required'
    );
  }

  const rawTransport = (process.env.TRANSPORT?.trim() || 'stdio').toLowerCase();
  if (rawTransport !== 'stdio' && rawTransport !== 'http') {
    throw new Error(`Invalid TRANSPORT "${process.env.TRANSPORT}". Expected "stdio" or "http".`);
  }

  const rawPort = process.env.PORT?.trim() || '3000';
  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Invalid PORT "${process.env.PORT}". Expected an integer between 1 and 65535.`);
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${process.env.PORT}". Expected an integer between 1 and 65535.`);
  }

  const mcpAuthToken = process.env.MCP_AUTH_TOKEN?.trim() || undefined;

  return {
    tududuApiUrl,
    tududuApiKey,
    tududuEmail,
    tududuPassword,
    logLevel: process.env.LOG_LEVEL || 'info',
    transport: rawTransport,
    port,
    mcpAuthToken,
  };
}
