// Time utility functions for parsing ranges and formatting

// Standard time periods in milliseconds
const TIME_PERIODS = {
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  'day': 24 * 60 * 60 * 1000,
  'month': 30 * 24 * 60 * 60 * 1000,
  'year': 365 * 24 * 60 * 60 * 1000
};

function parseTimeRange(range) {
  // Check if it's a standard period
    if (TIME_PERIODS[range]) {
      return TIME_PERIODS[range];
    }

  // Parse custom format (e.g., 7d, 3h)
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

  // Parse relative ranges like '7d', '3h' or standard labels
  function parseRelativeRange(range) {
    // Check if it's a standard period
    if (TIME_PERIODS[range]) {
      return TIME_PERIODS[range];
    }

    // Parse custom format (e.g., 7d, 3h)
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

  // Parse a range and return an interval object { start: Date, end: Date }
  // For relative ranges, end will be 'now'. For absolute ranges (year, month, day)
  // the interval will be the full period.
  function parseRangeToInterval(range) {
    if (!range || typeof range !== 'string') return null;

    // Try relative first
    const relativeMs = parseRelativeRange(range);
    if (relativeMs !== null) {
      const end = new Date();
      const start = new Date(Date.now() - relativeMs);
      return { start, end };
    }

    // Absolute formats
    // YYYY (e.g., 2025)
    const yearMatch = range.match(/^(\d{4})$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
      return { start, end };
    }

    // YYYY-MM (ISO month e.g., 2025-12)
    const monthMatch = range.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (monthMatch) {
      const year = parseInt(monthMatch[1]);
      const month = parseInt(monthMatch[2]);
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      return { start, end };
    }

    // YYYY-MM-DD (ISO date)
    const isoDateMatch = range.match(/^(\d{4})-(0[1-9]|1\d|2\d|3[01])-(0[1-9]|[12]\d|3[01])$/);
    if (isoDateMatch) {
      const year = parseInt(isoDateMatch[1]);
      const month = parseInt(isoDateMatch[2]);
      const day = parseInt(isoDateMatch[3]);
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
      return { start, end };
    }

    // MM/DD/YYYY (common US format e.g., 12/10/2025)
    const usDateMatch = range.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usDateMatch) {
      const month = parseInt(usDateMatch[1]);
      const day = parseInt(usDateMatch[2]);
      const year = parseInt(usDateMatch[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
        return { start, end };
      }
    }

    return null;
  }

  function getStartTime(range) {
    // Return interval object { start, end } or null
    return parseRangeToInterval(range);
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
  return parseRangeToInterval(range) !== null;
}

function getTimeRangeInHours(range) {
  const interval = parseRangeToInterval(range);
  if (!interval) return null;
  const end = interval.end || new Date();
  return (end - interval.start) / (60 * 60 * 1000);
}

module.exports = {
  parseRelativeRange,
  parseRangeToInterval,
  getStartTime,
  formatTimeRange,
  isValidTimeRange,
  getTimeRangeInHours
};