import { validateCronExpression } from 'cron';
import type { AIProvider, AppConfig } from './types.js';
const VALID_PROVIDERS = new Set<AIProvider>(['openai-completions', 'openai-responses', 'google', 'anthropic']);

function requiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(
      `Invalid TIMEZONE: ${timezone}. Use IANA timezone names like Asia/Shanghai, UTC, America/New_York`,
    );
  }
}

export function loadConfig(): AppConfig {
  const provider = (process.env.AI_PROVIDER || 'openai-completions') as AIProvider;
  const timezone = process.env.TIMEZONE || process.env.TZ || 'Asia/Shanghai';
  const cron = process.env.CRON;

  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(
      `Invalid AI_PROVIDER: ${provider}. Must be one of: openai-completions, openai-responses, google, anthropic`,
    );
  }

  validateTimezone(timezone);

  if (cron) {
    const cronValidation = validateCronExpression(cron);
    if (!cronValidation.valid) {
      throw new Error(`Invalid CRON: ${cron}. ${cronValidation.error}`);
    }
  }

  return {
    githubToken: process.env.GITHUB_TOKEN || undefined,
    telegramBotToken: requiredEnv('TELEGRAM_BOT_TOKEN'),
    telegramChatId: requiredEnv('TELEGRAM_CHAT_ID'),
    aiProvider: provider,
    aiBaseUrl: process.env.AI_BASE_URL || undefined,
    aiApiKey: requiredEnv('AI_API_KEY'),
    aiModel: requiredEnv('AI_MODEL'),
    cron,
    timezone,
    targetLang: process.env.TARGET_LANG || 'English',
  };
}

export function loadSubscriptions(): string[] {
  const envRepos = process.env.SUBSCRIBE_REPOS;
  if (!envRepos) {
    throw new Error(
      'Missing required env: SUBSCRIBE_REPOS. Set comma-separated repos, e.g. SUBSCRIBE_REPOS=vuejs/core,nodejs/node',
    );
  }

  const repos = envRepos
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  if (repos.length === 0) {
    throw new Error('SUBSCRIBE_REPOS is empty. Add at least one repo.');
  }

  return repos;
}
