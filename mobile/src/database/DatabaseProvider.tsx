import React, { createContext, useContext } from 'react';
import { database } from './index';
import { Database } from '@nozbe/watermelondb';

const DatabaseContext = createContext<Database | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
