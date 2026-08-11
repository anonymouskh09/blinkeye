const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
  : path.join(backendDir, 'venv', 'bin', 'python');

const pythonBin = fs.existsSync(venvPython) ? venvPython : (isWin ? 'python' : 'python3');

console.log('==================================================');
console.log('🚀 RecruitPro Full-Stack Application Launcher');
console.log('==================================================');

// 1. Seed Database
console.log('\n[1/3] 🗄️  Initializing database & seeding default admin...');
try {
  execSync(`"${pythonBin}" -m app.core.seed`, {
    cwd: backendDir,
    stdio: 'inherit'
  });
  console.log('✅ Database check completed.');
} catch (err) {
  console.error('⚠️  Database seed warning:', err.message);
}

// 2. Start Backend
console.log('\n[2/3] 🐍 Starting FastAPI Backend on http://localhost:8000 ...');
const venvUvicorn = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'uvicorn.exe')
  : path.join(backendDir, 'venv', 'bin', 'uvicorn');

const uvicornCmd = fs.existsSync(venvUvicorn) ? venvUvicorn : 'uvicorn';

const backendProcess = spawn(uvicornCmd, ['main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  shell: true,
  env: { ...process.env }
});

backendProcess.stdout.on('data', (data) => {
  process.stdout.write(`[Backend] ${data}`);
});

backendProcess.stderr.on('data', (data) => {
  process.stderr.write(`[Backend] ${data}`);
});

// 3. Start Frontend
console.log('\n[3/3] ⚛️  Starting Next.js Frontend on http://localhost:3000 ...');
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  shell: true,
  env: { ...process.env }
});

frontendProcess.stdout.on('data', (data) => {
  process.stdout.write(`[Frontend] ${data}`);
});

frontendProcess.stderr.on('data', (data) => {
  process.stderr.write(`[Frontend] ${data}`);
});

// Clean termination handling
function shutdown() {
  console.log('\n🛑 Shutting down backend and frontend services...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
