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
