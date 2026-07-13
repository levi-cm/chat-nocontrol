import type { Locale } from "./index";

export function formatLocalDateTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatLocalNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatLocalCount(
  value: number,
  locale: Locale,
  labels: { one: string; other: string },
): string {
  const category = new Intl.PluralRules(locale).select(value);
  return `${formatLocalNumber(value, locale)} ${category === "one" ? labels.one : labels.other}`;
}
