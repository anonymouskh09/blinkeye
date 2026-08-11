const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const isWin = process.platform === 'win32';

const venvUvicorn = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'uvicorn.exe')
  : path.join(backendDir, 'venv', 'bin', 'uvicorn');

const uvicornCmd = fs.existsSync(venvUvicorn) ? venvUvicorn : 'uvicorn';

console.log('🐍 Starting FastAPI Backend on http://localhost:8000 ...');
const child = spawn(uvicornCmd, ['main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  shell: true,
  stdio: 'inherit'
});
