const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { loadEnvFile, parseEnvFile } = require('../loadEnv');

test('parseEnvFile handles comments, whitespace, and quotes', () => {
  const parsed = parseEnvFile(`\n# Comment\nOPENAI_API_KEY = "abc123"\nPORT=3001\nEMPTY=\n`);

  assert.equal(parsed.OPENAI_API_KEY, 'abc123');
  assert.equal(parsed.PORT, '3001');
  assert.equal(parsed.EMPTY, '');
});

test('loadEnvFile sets process.env values without overriding existing values', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-loader-test-'));
  const envPath = path.join(tempDir, '.env');

  fs.writeFileSync(envPath, 'OPENAI_API_KEY=from-file\nPORT=3333\n', 'utf8');

  const originalOpenAi = process.env.OPENAI_API_KEY;
  const originalPort = process.env.PORT;

  process.env.OPENAI_API_KEY = 'from-shell';
  delete process.env.PORT;

  try {
    loadEnvFile(envPath);

    assert.equal(process.env.OPENAI_API_KEY, 'from-shell');
    assert.equal(process.env.PORT, '3333');
  } finally {
    if (typeof originalOpenAi === 'undefined') {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAi;
    }

    if (typeof originalPort === 'undefined') {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
