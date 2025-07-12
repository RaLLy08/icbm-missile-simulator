export const formatSeconds = (
  seconds: number
): {
  value: number;
  unit: 'seconds' | 'min' | 'hr' | 'day';
} => {
  if (seconds >= 86400) {
    // 60 * 60 * 24
    return { value: parseFloat((seconds / 86400).toFixed(2)), unit: 'day' };
  } else if (seconds >= 3600) {
    // 60 * 60
    return { value: parseFloat((seconds / 3600).toFixed(2)), unit: 'hr' };
  } else if (seconds >= 60) {
    return { value: parseFloat((seconds / 60).toFixed(2)), unit: 'min' };
  } else {
    return { value: seconds, unit: 'seconds' };
  }
};


export const toExponentGrowth = (
  percentage: number,
  exponentBase = 2,
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
  return ((clampedValue - min) / (max - min));
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
