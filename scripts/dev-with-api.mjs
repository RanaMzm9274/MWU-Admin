import { spawn } from "node:child_process";
import "dotenv/config";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const apiBaseUrl = process.env.VITE_API_BASE_URL || "";
const shouldStartLocalApi = (() => {
  try {
    const url = new URL(apiBaseUrl);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return true;
  }
})();

const processes = [
  ...(shouldStartLocalApi
    ? [
        {
          name: "admin-api",
          command: "node",
          args: ["server/admin-api.js"]
        }
      ]
    : []),
  {
    name: "vite",
    command: npmCommand,
    args: ["run", "dev:vite", "--", "--host", "0.0.0.0"]
  }
];

if (!shouldStartLocalApi) {
  console.log(`[dev] Using external Admin API: ${apiBaseUrl}`);
}

const running = processes.map((entry) => {
  const child = spawn(entry.command, entry.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: isWindows,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${entry.name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${entry.name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[${entry.name}] exited with ${signal || code}`);
    shutdown(code || 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`[${entry.name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  return child;
});

let shuttingDown = false;

const shutdown = (code = 0) => {
  shuttingDown = true;
  running.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
  process.exit(code);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
