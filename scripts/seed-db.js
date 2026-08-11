const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const isWin = process.platform === 'win32';

const venvPython = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
  : path.join(backendDir, 'venv', 'bin', 'python');

const pythonBin = fs.existsSync(venvPython) ? venvPython : (isWin ? 'python' : 'python3');

console.log('🗄️ Seeding database...');
execSync(`"${pythonBin}" -m app.core.seed`, {
  cwd: backendDir,
  stdio: 'inherit'
});
console.log('✅ Database seeded successfully.');
