import en from "./locales/en.json";
import { assertValidLocaleMessages } from "./locale-validation";

export const DEFAULT_LOCALE = "en" as const;

// English ships in the main bundle as the fallback language. Every other locale
// file is its own chunk that is fetched only when that language is used: the
// ~40 catalogs are ~0.8MB each, and bundling them eagerly put ~31MB of JSON in
// front of every cold page load.
const localeLoaders = Object.fromEntries([
  [DEFAULT_LOCALE, async () => en],
  ...Object.entries(
    import.meta.glob<unknown>(["./locales/*.json", "!./locales/en.json"], { import: "default" }),
  ).map(([path, load]) => {
    const locale = path.match(/\/([A-Za-z0-9_-]+)\.json$/)?.[1];
    if (!locale) {
      throw new Error(`Invalid locale file path: ${path}`);
    }
    return [locale, load];
  }),
]) as Record<string, () => Promise<unknown>>;

export const supportedLocales = Object.keys(localeLoaders);

export const defaultLocaleMessages: Record<string, unknown> = en;

export type SupportedLocale = string;

// Every locale file is validated by locale-validation.test.ts. Re-validating a
// full catalog at runtime blocks the main thread, so only dev builds repeat it.
function validateInDev(locale: string, messages: unknown) {
  if (!import.meta.env.DEV) return;
  try {
    assertValidLocaleMessages(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${locale} locale messages: ${message}`);
  }
}

validateInDev(DEFAULT_LOCALE, en);

export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  const load = localeLoaders[locale];
  if (!load) throw new Error(`Unsupported locale: ${locale}`);
  const messages = (await load()) as Record<string, unknown>;
  validateInDev(locale, messages);
  return messages;
}
