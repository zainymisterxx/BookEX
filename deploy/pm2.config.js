// PM2 Ecosystem Config — BookEX Azure Production
// Usage: pm2 start deploy/pm2.config.js

module.exports = {
  apps: [
    {
      name: 'bookex',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/home/sabih/bookex',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/bookex-error.log',
      out_file: '/var/log/pm2/bookex-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    {
      name: 'bookex-socket',
      script: 'node_modules/.bin/tsx',
      args: 'server.ts',
      cwd: '/home/sabih/bookex',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: 3001,
      },
      error_file: '/var/log/pm2/bookex-socket-error.log',
      out_file: '/var/log/pm2/bookex-socket-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    {
      name: 'bookex-media',
      script: 'node_modules/.bin/tsx',
      args: 'media-api/server.ts',
      cwd: '/home/sabih/bookex',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        MEDIA_PORT: 4010,
        MEDIA_BIND_HOST: '127.0.0.1',
      },
      error_file: '/var/log/pm2/bookex-media-error.log',
      out_file: '/var/log/pm2/bookex-media-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
