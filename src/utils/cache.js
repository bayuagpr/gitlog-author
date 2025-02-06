/**
 * @module cache
 * @description Implements a Least Recently Used (LRU) caching mechanism
 */

/**
 * LRU Cache implementation using Map for O(1) operations
 * @class
 */
class LRUCache {
  /**
   * Creates a new LRU cache with specified maximum size
   * @constructor
   * @param {number} [maxSize=100] - Maximum number of items to store in cache
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Retrieves an item from the cache and marks it as most recently used
   * @param {string} key - Key to lookup in cache
   * @returns {*} Cached value or null if not found
   */
  get(key) {
    if (!this.cache.has(key)) return null;
    // Refresh the item
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Adds or updates an item in the cache
   * @param {string} key - Key to store value under
   * @param {*} value - Value to store in cache
   * @description If cache is full, removes least recently used item before adding new one
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove the oldest item
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}

module.exports = LRUCache; 