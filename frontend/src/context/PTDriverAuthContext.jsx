import { createContext, useContext, useState, useEffect } from 'react';

const PTDriverAuthContext = createContext({ user: null, loading: true, refresh: () => {} });

export function PTDriverAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/ptdriver/auth/me', { credentials: 'include' });
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
    <PTDriverAuthContext.Provider value={{ user, setUser, loading, refresh: fetchUser }}>
      {children}
    </PTDriverAuthContext.Provider>
  );
}

export function usePTDriverAuth() {
  return useContext(PTDriverAuthContext);
}

