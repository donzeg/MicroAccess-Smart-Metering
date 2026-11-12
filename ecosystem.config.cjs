const path = require('node:path');

const projectRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'msm-backend',
      cwd: path.join(projectRoot, 'backend'),
      script: 'dist/src/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000'
      }
    },
    {
      name: 'msm-web',
      cwd: path.join(projectRoot, 'web'),
      script: 'build/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '4173',
        ORIGIN: process.env.MSM_PUBLIC_ORIGIN || 'http://100.112.217.3:4173',
        MSM_API_BASE_URL: 'http://127.0.0.1:3000'
      }
    }
  ]
};
