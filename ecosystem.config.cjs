module.exports = {
  apps: [
    {
      name: 'crm-backend',
      script: 'packages/backend/dist/server.cjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
