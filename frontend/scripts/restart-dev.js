/**
 * Kill stale Next.js dev servers on 3000/3001, wipe .next cache, start fresh.
 * Run: npm run restart
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split("\n")) {
      const m = line.trim().match(/LISTENING\s+(\d+)/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`Stopped process ${pid} on port ${port}`);
      } catch { /* already gone */ }
    }
  } catch { /* no process on port */ }
}

killPort(3000);
killPort(3001);

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("Removed .next cache");
}

console.log("Starting dev server...");
execSync("next dev", { cwd: root, stdio: "inherit" });
