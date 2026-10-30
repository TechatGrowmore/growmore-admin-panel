import { createContext, useContext, useState, useEffect } from 'react';

const DriverAuthContext = createContext({ user: null, loading: true, refresh: () => {} });

export function DriverAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/driver/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        return data.user || null;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, []);

  return (
    <DriverAuthContext.Provider value={{ user, setUser, loading, refresh: fetchUser }}>
      {children}
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth() {
  return useContext(DriverAuthContext);
}
