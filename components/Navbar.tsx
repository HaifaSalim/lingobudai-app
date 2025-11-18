
import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, BookOpen, Settings, Mic } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Navbar: React.FC = () => {
  const linkClass = "flex flex-col items-center px-2 py-1 text-xs sm:flex-row sm:text-sm sm:space-x-2 rounded-md transition-colors font-accent";
  const activeLinkClass = "bg-blush text-gray-800 dark:bg-dark-blush dark:text-white";
  const inactiveLinkClass = "text-gray-600 hover:bg-lemon/60 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-dark-card dark:hover:text-white";

  return (
    <nav className="bg-white/80 backdrop-blur-md p-2 shadow-sm border-b border-lemon sticky top-0 z-40 dark:bg-dark-card/80 dark:border-dark-bg">
      <div className="container mx-auto flex justify-between items-center">
        <NavLink to="/" className="text-xl font-bold text-gray-800 dark:text-white flex items-center font-heading">
           <svg xmlns="http://www.w.org/2000/svg" className="h-8 w-8 mr-2 text-peach" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.28 15.36l-3.53-3.54c-.39-.39-.39-1.02 0-1.41l3.53-3.54c.63-.63 1.71-.18 1.71.71v7.08c0 .89-1.08 1.34-1.71.7zm5.56 0l-3.53-3.54c-.39-.39-.39-1.02 0-1.41l3.53-3.54c.63-.63 1.71-.18 1.71.71v7.08c0 .89-1.08 1.34-1.71.7z"/></svg>
           LingoBud AI
        </NavLink>
        <div className="flex items-center space-x-1 sm:space-x-4">
          <NavLink to="/" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
            <Mic size={20}/> <span>Talk</span>
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
            <MessageSquare size={20}/> <span>Chat</span>
          </NavLink>
          <NavLink to="/flashcards" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
            <BookOpen size={20}/> <span>Review</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `${linkClass} ${isActive ? activeLinkClass : inactiveLinkClass}`}>
            <Settings size={20}/> <span>Settings</span>
          </NavLink>
          <div className="border-l border-lemon dark:border-gray-600 h-6 mx-2"></div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;