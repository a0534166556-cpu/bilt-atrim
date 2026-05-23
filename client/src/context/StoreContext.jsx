import { createContext, useContext, useState, useEffect } from 'react';
import { fetchStore } from '../api';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [store, setStore] = useState(null);

  useEffect(() => {
    fetchStore().then(setStore).catch(console.error);
  }, []);

  return <StoreContext.Provider value={{ store, setStore }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
