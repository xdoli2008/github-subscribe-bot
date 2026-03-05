# GitHub Subscribe Bot

English | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

Subscribe to GitHub repository releases, automatically translate and categorize changelogs via AI, and push to Telegram channels/groups.

## Features

- Scheduled GitHub Release polling (with ETag caching to save API quota)
- Tag-based subscription for repos without releases
- AI-powered translation + categorization (Features, Bug Fixes, Performance, Refactoring, Documentation, Other)
- Multiple AI providers: OpenAI / Google Gemini / Anthropic Claude
- Configurable target language for translation (default: English)
- Auto-split Telegram messages (when exceeding 4096 characters)
- Auto-retry on send failure (up to 3 times)
- Deploy via Docker Compose or GitHub Actions (zero server needed)

## Quick Start

### Prerequisites

1. **Telegram Bot** — Create via [@BotFather](https://t.me/BotFather) to get the Bot Token
2. **Telegram Chat ID** — Channel username (e.g. `@my_channel`) or group/user numeric ID
3. **AI API Key** — From any supported AI provider
4. **GitHub Token** (Optional) — [Create a Personal Access Token](https://github.com/settings/tokens) for higher API rate limits. Recommended if you subscribe to many repos or use frequent polling

### Option 1: GitHub Actions (Recommended)

No server required. Fork and configure:

1. Fork this repository
2. Go to **Settings → Secrets and variables → Actions**
3. Add **Secrets** (encrypted):
   - `TELEGRAM_BOT_TOKEN` — Your Telegram Bot Token
   - `TELEGRAM_CHAT_ID` — Target channel/group ID
   - `AI_API_KEY` — AI service API Key
4. Add **Variables** (plaintext):
   - `SUBSCRIBE_REPOS` — Comma-separated repos, e.g. `vuejs/core,nodejs/node`
   - `AI_PROVIDER` — (Optional) AI provider, default `openai-completions`
   - `AI_MODEL` — (Optional) Model name, default `gpt-4o-mini`
   - `AI_BASE_URL` — (Optional) Custom API URL for proxy/self-hosted
   - `TIMEZONE` — (Optional) IANA timezone, default `Asia/Shanghai`
   - `TARGET_LANG` — (Optional) Translation target language, default `English`
5. Go to **Actions** tab → Enable workflows
6. Optionally trigger **Release Check** manually to test

> GitHub Actions provides a built-in `GITHUB_TOKEN` automatically (1000 req/hr). No need to configure it separately.

### Option 2: Docker Compose

```bash
git clone https://github.com/nicepkg/github-subscribe-bot.git
cd github-subscribe-bot

cp .env.example .env
# Edit .env with your configuration (see below)

docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Configuration

All settings are configured via environment variables in the `.env` file:

| Variable             | Required | Default              | Description                                   |
| -------------------- | -------- | -------------------- | --------------------------------------------- |
| `SUBSCRIBE_REPOS`    | ✅       | —                    | Comma-separated repos to subscribe (e.g. `vuejs/core,nodejs/node`) |
| `TELEGRAM_BOT_TOKEN` | ✅       | —                    | Telegram Bot Token                            |
| `TELEGRAM_CHAT_ID`   | ✅       | —                    | Target channel/group/user ID                  |
| `AI_API_KEY`         | ✅       | —                    | AI service API Key                            |
| `AI_MODEL`           | ❌       | `gpt-4o-mini`        | Model name                                    |
| `AI_PROVIDER`        | ❌       | `openai-completions` | AI provider (see below)                       |
| `AI_BASE_URL`        | ❌       | SDK default          | Custom API URL (proxy/self-hosted)            |
| `GITHUB_TOKEN`       | ❌       | —                    | GitHub PAT for higher rate limits (5000 req/hr vs 60 req/hr) |
| `TIMEZONE`           | ❌       | `Asia/Shanghai`      | IANA timezone for cron and message formatting |
| `CRON`               | ❌       | —                    | Cron expression (6 fields, with seconds). Required for Docker/local mode |
| `TARGET_LANG`        | ❌       | `English`            | Target language for AI translation            |

> `TARGET_LANG` controls both AI translation output and category labels (e.g. ✨ Features). Built-in label translations are available for `English`, `Chinese`, and `Japanese`. Other languages will use English labels with AI-translated content.
>
> If `TIMEZONE` is not set, the program falls back to `TZ`; if neither is set, defaults to `Asia/Shanghai`.
> `TIMEZONE` must be a valid IANA timezone (e.g. `Asia/Shanghai`, `UTC`). Formats like `UTC+8` are invalid and will cause a startup error.

### AI Providers

Supported `AI_PROVIDER` values:

| Value                | Description                                                           | AI_MODEL Example           |
| -------------------- | --------------------------------------------------------------------- | -------------------------- |
| `openai-completions` | OpenAI Chat Completions (default), compatible with all OpenAI proxies | `gpt-4o-mini`              |
| `openai-responses`   | OpenAI Responses API                                                  | `gpt-4o-mini`              |
| `google`             | Google Gemini                                                         | `gemini-2.0-flash`         |
| `anthropic`          | Anthropic Claude                                                      | `claude-sonnet-4-20250514` |

**Using a third-party proxy**: Set `AI_PROVIDER=openai-completions` and point `AI_BASE_URL` to your proxy.

`.env` example:

```env
# GITHUB_TOKEN=ghp_xxxxxxxxxxxx  # Optional, recommended for many repos
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=@my_channel
AI_PROVIDER=openai-completions
AI_API_KEY=sk-xxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
TIMEZONE=Asia/Shanghai
CRON=0 */10 9-23 * * *
TARGET_LANG=English
SUBSCRIBE_REPOS=vuejs/core,nodejs/node
```

### Scheduling (Cron)

In Docker/local mode, the program uses `CRON` for internal scheduling (via the `cron` package):

```env
TIMEZONE=Asia/Shanghai
CRON=0 */10 9-23 * * *
```

This means: every day 09:00–23:59, check every 10 minutes (no notifications at night).

Examples:

- Weekdays daytime every 10 min: `0 */10 9-23 * * 1-5`
- Daily at 08:30: `0 30 8 * * *`

> `CRON` uses 6-field format (second minute hour day month weekday), e.g. `0 */10 9-23 * * *`.
> In GitHub Actions mode, scheduling is handled by the workflow cron trigger — `CRON` is not needed.

## Subscription

Set the `SUBSCRIBE_REPOS` environment variable with comma-separated GitHub repos (`owner/repo` format):

```env
SUBSCRIBE_REPOS=vuejs/core,nodejs/node,microsoft/vscode
```

### Subscription Modes

Each repo can optionally specify a subscription mode with a `:mode` suffix:

| Format | Mode | Description |
|--------|------|-------------|
| `owner/repo` | `latest` | Subscribe to stable releases only (default, excludes prereleases) |
| `owner/repo:latest` | `latest` | Explicitly subscribe to stable releases only |
| `owner/repo:pre` | `pre` | Subscribe to prereleases only |
| `owner/repo:tag` | `tag` | Subscribe to new Git tags (for repos without Releases) |

Example:

```env
SUBSCRIBE_REPOS=vuejs/core,some-org/lib:pre,another/tool:tag
```

- `vuejs/core` — monitors stable releases (default, same as `:latest`)
- `some-org/lib:pre` — monitors prereleases only
- `another/tool:tag` — monitors new Git tags, generates changelog from commits between tags

> Backward compatibility: `:release` is still accepted and mapped to `:latest`.

In **tag mode**, the bot fetches commits between the previous and new tag (up to 50), feeds them to AI for categorization, and sends the result in the same format as release notifications.

For GitHub Actions, set this as a **Variable** in repository settings.
For Docker/local, add it to your `.env` file.

Restart the container after changes:

```bash
docker compose restart
```

## Message Format

Example Telegram message from the bot:

```
vuejs/core

2025-02-19 14:30:00  v3.5.0

✨ Features
• Added useTemplateRef API
• Support for deferred Teleport

🐛 Bug Fixes
• Fixed reactive array watch callback trigger issue

⚡ Performance
• Improved virtual DOM diff performance
```

AI automatically translates English release notes into the configured target language and groups them by category.

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your tokens and SUBSCRIBE_REPOS

npm run dev    # Dev mode (auto-restart on file changes)
npm start      # Run directly (daemon with internal cron)
npm run check  # Run once and exit (used by GitHub Actions)
npm run build  # Compile TypeScript
```

## Project Structure

```
├── src/
│   ├── index.ts       # Entry point, daemon with internal cron
│   ├── action.ts      # Single-run entry point (for GitHub Actions)
│   ├── config.ts      # Environment config loader
│   ├── types.ts       # Type definitions
│   ├── github.ts      # GitHub API client & state management
│   ├── ai.ts          # AI translation & categorization
│   ├── formatter.ts   # Telegram message formatting
│   ├── telegram.ts    # Telegram message sender (with retry)
│   └── logger.ts      # Logger utility
├── data/              # Runtime state (auto-generated)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
