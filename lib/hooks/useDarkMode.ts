import { useState, useEffect } from 'react';

const STORAGE_KEY = 'alby-lsp-dark-mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Get initial theme preference
    const getInitialTheme = () => {
      // Check if user has saved preference
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      if (savedTheme !== null) {
        return savedTheme === 'dark';
      }
      
      // Check system preference
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      // Default to light mode
      return false;
    };

    const initialTheme = getInitialTheme();
    setIsDark(initialTheme);
    setIsLoaded(true);
    
    // Apply theme to document
    if (initialTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    // Apply theme to document
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference to localStorage
    localStorage.setItem(STORAGE_KEY, newTheme ? 'dark' : 'light');
  };

  return [isDark, toggleDarkMode, isLoaded] as const;
}
