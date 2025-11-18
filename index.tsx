import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Fatal Error: Could not find root element to mount to.");
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Use the 'load' event to ensure all initial resources (scripts, styles, etc.)
// are fully loaded before initializing the app. This is the most robust
// way to prevent race conditions that lead to React error #185.
window.addEventListener('load', mountApp);
