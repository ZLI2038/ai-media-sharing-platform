declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TOKEN_SECRET?: string;
    OPENAI_API_KEY?: string;
  }
}
