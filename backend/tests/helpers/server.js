const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForHealth(port, timeoutMs = 4000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 75));
  }

  throw new Error(`Timed out waiting for server on port ${port}`);
}

async function startServer(extraEnv = {}) {
  const port = await getFreePort();
  const serverPath = path.resolve(__dirname, '../../server.js');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  await waitForHealth(port);

  return {
    port,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
      if (stderr.trim()) {
        throw new Error(`Server stderr:\n${stderr}`);
      }
    }
  };
}

module.exports = { startServer };
