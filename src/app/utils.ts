export type DurationUnit = 'd' | 'h' | 'min' | 'sec';

export type DurationPart = { value: number; unit: DurationUnit };

export type Duration = {
  negative: boolean;
  /** Non-zero parts, largest unit first. Always has at least one entry. */
  parts: DurationPart[];
};

/**
 * Splits a duration in seconds into day/hour/minute/second parts,
 * rounded to whole seconds. Zero parts are omitted (1h 0min 5sec -> 1h 5sec);
 * a zero duration returns a single 0 sec part.
 */
export const splitSeconds = (seconds: number): Duration => {
  const negative = seconds < 0;
  const total = Math.round(Math.abs(seconds));

  const parts: DurationPart[] = [
    { value: Math.floor(total / 86400), unit: 'd' },
    { value: Math.floor((total % 86400) / 3600), unit: 'h' },
    { value: Math.floor((total % 3600) / 60), unit: 'min' },
    { value: total % 60, unit: 'sec' },
  ].filter((p): p is DurationPart => p.value !== 0);

  // Zero duration: still return something to display ("00sec").
  if (parts.length === 0) parts.push({ value: 0, unit: 'sec' });

  return { negative, parts };
};

/** Pads a number to two digits: 5 -> "05". */
export const pad2 = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

/** Joins a Duration into a zero-padded string, e.g. "01h 02min 05sec". */
export const joinDuration = (
  { negative, parts }: Duration,
  separator = ' '
): string =>
  (negative ? '-' : '') +
  parts.map(({ value, unit }) => `${pad2(value)}${unit}`).join(separator);

/** Formats seconds as e.g. "01h 02min 10sec". */
export const formatSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '—';
  return joinDuration(splitSeconds(seconds));
};

/**
 * Formats a value with thousands separators and a unit,
 * e.g. formatUnit(1234567.8, 'm') -> "1,234,568 m".
 */
export const formatUnit = (
  value: number,
  unit: string,
  fractionDigits = 0
): string => {
  if (!Number.isFinite(value)) return '—';
  const text = value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${text} ${unit}`;
};

/** Formats meters, e.g. formatMeters(1234567) -> "1,234,567 m". */
export const formatMeters = (meters: number, fractionDigits = 0): string =>
  formatUnit(meters, 'm', fractionDigits);

/**
 * Formats a distance given in meters as kilometers,
 * e.g. formatKm(1234567) -> "1,234.6 km". Display only: all internal
 * values stay in meters.
 */
export const formatKm = (meters: number, fractionDigits = 1): string =>
  formatUnit(meters / 1000, 'km', fractionDigits);

export const toExponentGrowth = (
  percentage: number,
  exponentBase = 2
): number => {
  return (Math.pow(exponentBase, percentage) - 1) / (exponentBase - 1);
};

/**
 * Normalizes a value between a given min and max range.
 * @returns A normalized number between 0 and 1.
 * @example
 * normalizeBetween(5, 0, 10); // returns 0.5
 */
export const normalizeBetween = (
  value: number,
  min: number,
  max: number
): number => {
  const clampedValue = Math.max(min, Math.min(max, value));
  return (clampedValue - min) / (max - min);
};

/**
 * Clamps a normalized value between a given min and max range considering the range.
 * @returns A clamped value between min and max.
 * @example
 * clampNormalized(0.5, 0, 10); // returns 5
 * clampNormalized(0, 5, 10); // returns 5
 */
export const clampNormalized = (
  normalizedValue: number,
  min: number,
  max: number
): number => {
  return min + normalizedValue * (max - min);
};
