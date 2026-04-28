import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center
        ${theme === 'dark' 
          ? 'bg-base-alt text-yellow-400 hover:bg-base border border-border shadow-[0_0_15px_rgba(250,204,21,0.1)]' 
          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
        } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};

export default ThemeToggle;
