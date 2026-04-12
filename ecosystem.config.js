module.exports = {
  apps: [
    {
      name: "jomon-web",
      script: "npm",
      args: "start",
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
    },
    {
      name: "jomon-crawler",
      script: "scripts/daily-crawler.js",
      cron_restart: "0 2 * * *",
      env: {
        NODE_ENV: "production",
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        GOOGLE_CUSTOM_SEARCH_API_KEY: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
        GOOGLE_CUSTOM_SEARCH_ENGINE_ID: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
      },
      error_file: "logs/crawler-error.log",
      out_file: "logs/crawler-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "jomon-refine",
      script: "scripts/refine-facilities.js",
      cron_restart: "0 3 * * *",
      env: {
        NODE_ENV: "production"
      },
      error_file: "logs/refine-error.log",
      out_file: "logs/refine-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "jomon-regenerate-images",
      script: "scripts/regenerate-images.js",
      cron_restart: "30 3 * * 6",
      env: {
        NODE_ENV: "production"
      },
      error_file: "logs/regenerate-error.log",
      out_file: "logs/regenerate-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "1G"
    },
    {
      name: "jomon-generate-missing",
      script: "scripts/generate-missing-images.js",
      cron_restart: "0 4 * * 6",
      env: {
        NODE_ENV: "production",
        GEMINI_API_KEY20261336: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      error_file: "logs/generate-missing-error.log",
      out_file: "logs/generate-missing-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "1G"
    },
    {
      name: "jomon-events",
      script: "scripts/collect-events.js",
      cron_restart: "30 4 * * 0",
      env: {
        NODE_ENV: "production",
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY
      },
      error_file: "logs/events-error.log",
      out_file: "logs/events-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
