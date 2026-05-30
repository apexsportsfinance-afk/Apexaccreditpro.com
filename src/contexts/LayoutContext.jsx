import React, { createContext, useContext, useState } from 'react';

const LayoutContext = createContext({});

export function LayoutProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('');

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, activeItem, setActiveItem }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
