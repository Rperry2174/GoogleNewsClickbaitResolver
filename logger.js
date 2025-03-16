/**
 * Logger utility for GoogleNewsClickbaitResolver
 * 
 * Provides extensive logging capabilities that can be easily toggled on/off.
 * Set DEBUG_MODE to false to disable all logging at once.
 */

// Global debug flag - Set to false to disable all logging
let DEBUG_MODE = true;

// Log level configuration
const LOG_LEVELS = {
  INFO: true,    // General information
  DEBUG: true,   // Detailed debugging info
  WARN: true,    // Warnings
  ERROR: true,   // Errors
  PERF: true,    // Performance measurements
  CLICKBAIT: true // Special clickbait detection logs
};

// Logger implementation
const Logger = {
  /**
   * Set the debug mode dynamically
   * @param {boolean} mode - Whether debug mode is enabled
   */
  setDebugMode(mode) {
    DEBUG_MODE = mode;
    this.info(`Debug mode ${mode ? 'enabled' : 'disabled'}`);
  },

  /**
   * Logs general information
   * @param {string} message - The message to log
   * @param {any} data - Optional data to include
   */
  info(message, data) {
    if (DEBUG_MODE && LOG_LEVELS.INFO) {
      if (data) {
        console.log(`%c[INFO] ${message}`, 'color: #1a73e8', data);
      } else {
        console.log(`%c[INFO] ${message}`, 'color: #1a73e8');
      }
    }
  },

  /**
   * Logs detailed debugging information
   * @param {string} message - The message to log
   * @param {any} data - Optional data to include
   */
  debug(message, data) {
    if (DEBUG_MODE && LOG_LEVELS.DEBUG) {
      if (data) {
        console.log(`%c[DEBUG] ${message}`, 'color: #4caf50', data);
      } else {
        console.log(`%c[DEBUG] ${message}`, 'color: #4caf50');
      }
    }
  },

  /**
   * Logs warnings
   * @param {string} message - The message to log
   * @param {any} data - Optional data to include
   */
  warn(message, data) {
    if (DEBUG_MODE && LOG_LEVELS.WARN) {
      if (data) {
        console.warn(`%c[WARN] ${message}`, 'color: #ff9800', data);
      } else {
        console.warn(`%c[WARN] ${message}`, 'color: #ff9800');
      }
    }
  },

  /**
   * Logs errors
   * @param {string} message - The message to log
   * @param {any} data - Optional data to include
   */
  error(message, data) {
    if (DEBUG_MODE && LOG_LEVELS.ERROR) {
      if (data) {
        console.error(`%c[ERROR] ${message}`, 'color: #f44336', data);
      } else {
        console.error(`%c[ERROR] ${message}`, 'color: #f44336');
      }
    }
  },

  /**
   * Logs clickbait detection with high visibility
   * @param {string} message - The message to log
   * @param {any} data - Optional data to include
   */
  clickbait(message, data) {
    if (DEBUG_MODE && LOG_LEVELS.CLICKBAIT) {
      const style = 'color: #ffffff; background-color: #e91e63; padding: 2px 5px; border-radius: 3px; font-weight: bold';
      if (data) {
        console.log(`%c[CLICKBAIT] ${message}`, style, data);
      } else {
        console.log(`%c[CLICKBAIT] ${message}`, style);
      }
    }
  },

  /**
   * Logs performance information with timing
   * @param {string} label - The label for the performance measurement
   */
  time(label) {
    if (DEBUG_MODE && LOG_LEVELS.PERF) {
      console.time(`%c[PERF] ${label}`);
    }
  },

  /**
   * Ends performance timing and logs the result
   * @param {string} label - The label used in the corresponding time() call
   */
  timeEnd(label) {
    if (DEBUG_MODE && LOG_LEVELS.PERF) {
      console.timeEnd(`%c[PERF] ${label}`);
    }
  },

  /**
   * Groups log messages together
   * @param {string} label - The group label
   */
  group(label) {
    if (DEBUG_MODE) {
      console.group(`%c[GROUP] ${label}`, 'color: #9c27b0; font-weight: bold');
    }
  },

  /**
   * Ends a log group
   */
  groupEnd() {
    if (DEBUG_MODE) {
      console.groupEnd();
    }
  },
  
  /**
   * Creates a table visualization of data
   * @param {Array|Object} data - The data to display as a table
   */
  table(data) {
    if (DEBUG_MODE) {
      console.table(data);
    }
  }
};

// Export the logger
window.Logger = Logger;