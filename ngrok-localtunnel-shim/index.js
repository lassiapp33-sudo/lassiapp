const ngrok = require("@ngrok/ngrok");
const fs = require("fs");
const path = require("path");
const os = require("os");

function readToken() {
  if (process.env.NGROK_AUTHTOKEN) return process.env.NGROK_AUTHTOKEN;

  const v2Config = path.join(os.homedir(), ".ngrok2", "ngrok.yml");
  if (fs.existsSync(v2Config)) {
    const match = fs.readFileSync(v2Config, "utf8").match(/authtoken:\s*(\S+)/);
    if (match) return match[1];
  }

  const v3Config = path.join(os.homedir(), ".config", "ngrok", "ngrok.yml");
  if (fs.existsSync(v3Config)) {
    const match = fs.readFileSync(v3Config, "utf8").match(/authtoken:\s*(\S+)/);
    if (match) return match[1];
  }

  return null;
}

let activeListener = null;

async function connect(opts) {
  const addr = opts.addr || opts.port || 8081;
  const port =
    typeof addr === "string" ? parseInt(addr.split(":").pop(), 10) : addr;

  if (activeListener) {
    await activeListener.close();
    activeListener = null;
  }

  const listener = await ngrok.forward({
    addr: port,
    authtoken: readToken(),
  });

  activeListener = listener;
  return listener.url();
}

async function disconnect() {
  if (activeListener) {
    await activeListener.close();
    activeListener = null;
  }
}

async function kill() {
  await disconnect();
  await ngrok.disconnect();
}

class NgrokClientError extends Error {
  constructor(message, response, body) {
    super(message);
    this.name = "NgrokClientError";
    this.response = response;
    this.body = body;
  }
}

module.exports = {
  connect,
  disconnect,
  authtoken: async () => {},
  kill,
  getUrl: () => null,
  getApi: () => null,
  getVersion: async () => "4.1.3",
  getActiveProcess: () => null,
  NgrokClientError,
};
