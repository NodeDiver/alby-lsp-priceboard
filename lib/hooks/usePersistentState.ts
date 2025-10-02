import { useState, useEffect } from 'react';

/**
 * Custom hook for managing state that persists to localStorage
 * @param key - localStorage key
 * @param defaultValue - default value if nothing in localStorage
 * @returns [value, setValue] tuple
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(key);
        if (saved !== null) {
          return JSON.parse(saved);
        }
      } catch (error) {
        console.warn(`Failed to parse localStorage value for key "${key}":`, error);
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Failed to save to localStorage for key "${key}":`, error);
      }
    }
  }, [key, value]);

  return [value, setValue];
}
