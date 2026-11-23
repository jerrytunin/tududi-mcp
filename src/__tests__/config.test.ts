import { getConfig, normalizeTududiApiUrl } from '../config.js';

describe('normalizeTududiApiUrl', () => {
  it('strips trailing slashes and /api or /api/v1 suffixes', () => {
    expect(normalizeTududiApiUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeTududiApiUrl('http://localhost:3000/api')).toBe('http://localhost:3000');
    expect(normalizeTududiApiUrl('http://localhost:3000/api/')).toBe('http://localhost:3000');
    expect(normalizeTududiApiUrl('http://localhost:3000/api/v1')).toBe('http://localhost:3000');
    expect(normalizeTududiApiUrl('http://localhost:3000/api/v1/')).toBe('http://localhost:3000');
    expect(normalizeTududiApiUrl(' https://tududi.example.com/sub/api/v1/ ')).toBe(
      'https://tududi.example.com/sub'
    );
  });
});

describe('getConfig', () => {
  const BASE_ENV = {
    TUDUDI_API_URL: 'http://localhost:8080',
    TUDUDI_API_KEY: 'test-key',
  };

  let savedEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    process.env.LOG_LEVEL = 'silent';
    savedEnv = { ...process.env };
  });

  beforeEach(() => {
    process.env = { ...savedEnv, ...BASE_ENV };
    delete process.env.TRANSPORT;
    delete process.env.PORT;
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.TUDUDI_EMAIL;
    delete process.env.TUDUDI_PASSWORD;
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it('normalizes TUDUDI_API_URL when trailing /api/v1 is included', () => {
    process.env.TUDUDI_API_URL = 'http://localhost:8080/api/v1/';
    expect(getConfig().tududuApiUrl).toBe('http://localhost:8080');
  });

  it('throws when TUDUDI_API_URL is missing', () => {
    delete process.env.TUDUDI_API_URL;
    expect(() => getConfig()).toThrow('TUDUDI_API_URL environment variable is required');
  });

  it('accepts email and password when TUDUDI_API_KEY is omitted', () => {
    delete process.env.TUDUDI_API_KEY;
    process.env.TUDUDI_EMAIL = 'user@example.com';
    process.env.TUDUDI_PASSWORD = 'secret';

    const cfg = getConfig();
    expect(cfg.tududuEmail).toBe('user@example.com');
    expect(cfg.tududuPassword).toBe('secret');
  });

  it('throws when neither API key nor email/password are provided', () => {
    delete process.env.TUDUDI_API_KEY;
    expect(() => getConfig()).toThrow('Either TUDUDI_API_KEY or both TUDUDI_EMAIL');
  });

  it('defaults transport to stdio', () => {
    expect(getConfig().transport).toBe('stdio');
  });

  it('sets transport to http case-insensitively', () => {
    process.env.TRANSPORT = 'HTTP';
    expect(getConfig().transport).toBe('http');
  });

  it('throws on invalid TRANSPORT', () => {
    process.env.TRANSPORT = 'websocket';
    expect(() => getConfig()).toThrow('Invalid TRANSPORT');
  });

  it('defaults port to 3000', () => {
    expect(getConfig().port).toBe(3000);
  });

  it('parses port from PORT env var', () => {
    process.env.PORT = '8080';
    expect(getConfig().port).toBe(8080);
  });

  it('throws on non-numeric or out-of-range PORT', () => {
    process.env.PORT = 'abc';
    expect(() => getConfig()).toThrow('Invalid PORT');

    process.env.PORT = '3000abc';
    expect(() => getConfig()).toThrow('Invalid PORT');

    process.env.PORT = '0';
    expect(() => getConfig()).toThrow('Invalid PORT');

    process.env.PORT = '65536';
    expect(() => getConfig()).toThrow('Invalid PORT');
  });

  it('trims optional MCP_AUTH_TOKEN and omits empty values', () => {
    expect(getConfig().mcpAuthToken).toBeUndefined();

    process.env.MCP_AUTH_TOKEN = '   ';
    expect(getConfig().mcpAuthToken).toBeUndefined();

    process.env.MCP_AUTH_TOKEN = '  secret-token  ';
    expect(getConfig().mcpAuthToken).toBe('secret-token');
  });
});
