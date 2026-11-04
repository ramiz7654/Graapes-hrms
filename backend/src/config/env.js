import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the .env that lives in the repository root (three levels above backend/src/config).
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('test-only-secret-test-only-secret-1234'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(8),
  COMPANY_TIMEZONE: z.string().default('Asia/Kolkata'),
  // Credential e-mails (Resend). Both blank = e-mail is simply reported as "not configured"; nothing else breaks.
  RESEND_API_KEY: z.string().trim().optional().transform((v) => v || undefined),
  EMAIL_FROM: z.string().trim().optional().transform((v) => v || undefined),
  // Link placed in the e-mail. Falls back to WEB_ORIGIN.
  WEB_APP_URL: z.string().trim().optional().transform((v) => v || undefined),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET must be set explicitly in production.');
  process.exit(1);
}

export const env = parsed.data;
