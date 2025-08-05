// Time utility functions for parsing ranges and formatting

function parseTimeRange(range) {
  const units = {
    'h': 60 * 60 * 1000,      // hours
    'd': 24 * 60 * 60 * 1000, // days
    'w': 7 * 24 * 60 * 60 * 1000, // weeks
    'm': 30 * 24 * 60 * 60 * 1000  // months (approximate)
  };

  const match = range.match(/^(\d+)([hdwm])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  return parseInt(amount) * units[unit];
}

function getStartTime(range) {
  const timeRange = parseTimeRange(range);
  if (!timeRange) return null;
  return new Date(Date.now() - timeRange);
}

function formatTimeRange(milliseconds) {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}m`;
  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

function isValidTimeRange(range) {
  return parseTimeRange(range) !== null;
}

function getTimeRangeInHours(range) {
  const milliseconds = parseTimeRange(range);
  if (!milliseconds) return null;
  return milliseconds / (60 * 60 * 1000);
}

module.exports = {
  parseTimeRange,
  getStartTime,
  formatTimeRange,
  isValidTimeRange,
  getTimeRangeInHours
};