// PM2 Ecosystem Config
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js --env production
//   pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: "nexus-erp",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/nexus-erp",

      // ── Instances ──────────────────────────────────
      instances: "max",          // one per CPU core
      exec_mode: "cluster",      // load balanced

      // ── Memory / Auto-restart ──────────────────────
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 10,

      // ── Environment ───────────────────────────────
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // ── Logs ──────────────────────────────────────
      log_file:    "/var/log/nexus-erp/combined.log",
      out_file:    "/var/log/nexus-erp/out.log",
      error_file:  "/var/log/nexus-erp/error.log",
      merge_logs:  true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // ── Monitoring ────────────────────────────────
      watch: false,
      autorestart: true,

      // ── Graceful shutdown ─────────────────────────
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
