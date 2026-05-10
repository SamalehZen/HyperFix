import 'server-only';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached: string | null = null;

export function getOpenUISystemPrompt(): string {
  if (cached !== null) return cached;
  try {
    cached = readFileSync(
      join(process.cwd(), 'ai/openui/system-prompt.generated.txt'),
      'utf-8',
    );
  } catch (err) {
    console.warn(
      '[openui] system-prompt.generated.txt not found. Run `pnpm generate:openui` to generate it. Falling back to empty prompt.',
    );
    cached = '';
  }
  return cached;
}
