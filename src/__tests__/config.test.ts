import { getConfig } from '../config.js';

describe('getConfig - transport and port', () => {
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
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it('defaults transport to stdio', () => {
    delete process.env.TRANSPORT;
    expect(getConfig().transport).toBe('stdio');
  });

  it('sets transport to http when TRANSPORT=http', () => {
    process.env.TRANSPORT = 'http';
    expect(getConfig().transport).toBe('http');
  });

  it('defaults port to 3000', () => {
    delete process.env.PORT;
    expect(getConfig().port).toBe(3000);
  });

  it('parses port from PORT env var', () => {
    process.env.PORT = '8080';
    expect(getConfig().port).toBe(8080);
  });
});
