import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("rental-book-token")),
  );

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("rental-book-token");
    if (!token) return undefined;

    api.get("/api/auth/me")
      .then((response) => { if (active) setUser(response.data.result); })
      .catch(() => {
        localStorage.removeItem("rental-book-token");
        if (active) setUser(null);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    signIn(nextUser, token) {
      localStorage.setItem("rental-book-token", token);
      setUser(nextUser);
    },
    signOut() {
      localStorage.removeItem("rental-book-token");
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
