import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AIProvider, AppConfig } from './types.js';

const ROOT = resolve(import.meta.dirname, '..');
const VALID_PROVIDERS = new Set<AIProvider>(['openai-completions', 'openai-responses', 'google', 'anthropic']);

function requiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

export function loadConfig(): AppConfig {
  const provider = (process.env.AI_PROVIDER || 'openai-completions') as AIProvider;
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(
      `Invalid AI_PROVIDER: ${provider}. Must be one of: openai-completions, openai-responses, google, anthropic`,
    );
  }

  return {
    githubToken: requiredEnv('GITHUB_TOKEN'),
    telegramBotToken: requiredEnv('TELEGRAM_BOT_TOKEN'),
    telegramChatId: requiredEnv('TELEGRAM_CHAT_ID'),
    aiProvider: provider,
    aiBaseUrl: process.env.AI_BASE_URL || undefined,
    aiApiKey: requiredEnv('AI_API_KEY'),
    aiModel: requiredEnv('AI_MODEL'),
    checkInterval: Number(process.env.CHECK_INTERVAL) || 900,
  };
}

export function loadSubscriptions(): string[] {
  const filePath = resolve(ROOT, 'subscribe.json');
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw) as { repos: string[] };
  return data.repos;
}
