module.exports = {
  apps: [
    {
      name: 'hypersignal-worker',
      script: 'node',
      args: '.next/standalone/src/backend/worker.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      max_memory_restart: '300M',
      out_file: './pm2-out.log',
      error_file: './pm2-error.log',
      time: true
    },
    {
      name: 'hypersignal-web',
      script: 'node',
      args: '.next/standalone/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      watch: false,
      max_memory_restart: '400M',
      out_file: './pm2-web-out.log',
      error_file: './pm2-web-error.log',
      time: true
    }
  ]
};
