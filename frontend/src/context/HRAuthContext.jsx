import { createContext, useContext, useState, useEffect } from 'react';

const HRAuthContext = createContext({ user: null, loading: true, refresh: () => {} });

export function HRAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/hr/auth/me', { credentials: 'include' });
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
    <HRAuthContext.Provider value={{ user, setUser, loading, refresh: fetchUser }}>
      {children}
    </HRAuthContext.Provider>
  );
}

export function useHRAuth() {
  return useContext(HRAuthContext);
}
