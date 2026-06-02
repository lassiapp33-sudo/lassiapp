const { spawn } = require('child_process');

let cfProcess = null;

function cleanup() {
  if (cfProcess) {
    try { cfProcess.kill(); } catch(e) {}
    cfProcess = null;
  }
}
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function startTunnel(port) {
  return new Promise((resolve, reject) => {
    cfProcess = spawn('cloudflared', [
      'tunnel', '--url', `http://localhost:${port}`
    ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

    cfProcess.on('error', err =>
      reject(new Error('cloudflared introuvable : ' + err.message))
    );

    let output = '';
    let resolved = false;

    cfProcess.stderr.on('data', (data) => {
      output += data.toString();
      const m = output.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
      if (m && !resolved) {
        resolved = true;
        console.log('\n\x1b[32m  Tunnel Cloudflare : ' + m[0] + '\x1b[0m');
        console.log('\x1b[90m  Scanne le QR code avec la camera iPhone -> Expo Go\x1b[0m\n');
        resolve(m[0]);
      }
    });

    setTimeout(() => {
      if (!resolved) reject(new Error('Timeout : URL cloudflared introuvable apres 60s'));
    }, 60000);
  });
}

// Expo SDK 54 appelle instance.connect(portOrOptions)
async function connect(portOrOptions) {
  const port = typeof portOrOptions === 'object'
    ? (portOrOptions.port || portOrOptions.addr || 8081)
    : portOrOptions;
  return startTunnel(port);
}

async function connectAsync(port) { return startTunnel(port); }
async function disconnect() { cleanup(); }
async function disconnectAsync() { cleanup(); }
async function kill() { cleanup(); }
async function killAsync() { cleanup(); }

module.exports = { connect, connectAsync, disconnect, disconnectAsync, kill, killAsync };
