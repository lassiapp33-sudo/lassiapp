const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

const logger = {
  warn: (...args: unknown[]) => {
    if (dev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (dev) console.error(...args);
  },
};

export default logger;
