module.exports = {
  apps: [
    {
      name: "jomon-web",
      script: "npm",
      args: "start",
      cwd: "/c/Users/ninja/.gemini/antigravity/scratch/jomon-portal",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "logs/web-error.log",
      out_file: "logs/web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      instances: 1,
      exec_mode: "fork"
    }
  ]
};
