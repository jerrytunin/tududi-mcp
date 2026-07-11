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
}

export function getConfig(): Config {
  const tududuApiUrl = process.env.TUDUDI_API_URL;
  const tududuApiKey = process.env.TUDUDI_API_KEY;
  const tududuEmail = process.env.TUDUDI_EMAIL;
  const tududuPassword = process.env.TUDUDI_PASSWORD;

  if (!tududuApiUrl) {
    throw new Error('TUDUDI_API_URL environment variable is required');
  }

  // Support either API key OR email/password authentication
  if (!tududuApiKey && (!tududuEmail || !tududuPassword)) {
    throw new Error(
      'Either TUDUDI_API_KEY or both TUDUDI_EMAIL and TUDUDI_PASSWORD environment variables are required'
    );
  }

  return {
    tududuApiUrl,
    tududuApiKey,
    tududuEmail,
    tududuPassword,
    logLevel: process.env.LOG_LEVEL || 'info',
    transport: (process.env.TRANSPORT || 'stdio') as 'stdio' | 'http',
    port: parseInt(process.env.PORT || '3000', 10),
  };
}
