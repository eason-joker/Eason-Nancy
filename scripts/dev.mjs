import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

const children = [
  spawn(npm, ['run', 'dev:server'], { stdio: 'inherit', shell: false }),
  spawn(npm, ['run', 'dev:client'], { stdio: 'inherit', shell: false })
];

const shutdown = (code = 0) => {
  for (const child of children) child.kill();
  process.exit(code);
};

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) shutdown(code);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
