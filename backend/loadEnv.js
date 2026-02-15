const fs = require('fs');
const path = require('path');

function stripWrappingQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvFile(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    parsed[key] = stripWrappingQuotes(rawValue);
  }

  return parsed;
}

function loadEnvFile(envFilePath) {
  const absolutePath = path.resolve(envFilePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  const parsed = parseEnvFile(fileContent);

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

module.exports = { loadEnvFile, parseEnvFile };
