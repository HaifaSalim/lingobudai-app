
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-lemon/60 dark:hover:bg-dark-card focus:outline-none focus:ring-2 focus:ring-peach"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

export default ThemeToggle;
