module.exports = {
  apps: [
    {
      name: 'six-hats-api',
      script: 'api/index.ts',
      interpreter: '/usr/bin/npx',
      interpreter_args: 'tsx',
      cwd: '/root/six-hats',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
