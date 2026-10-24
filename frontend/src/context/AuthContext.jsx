import { createContext, useCallback, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

const getSavedUser = () => {
  if (!localStorage.getItem("shopmart_token")) {
    localStorage.removeItem("shopmart_user");
    return null;
  }
  try {
    const saved = localStorage.getItem("shopmart_user");
    const user = saved ? JSON.parse(saved) : null;
    return user && typeof user === "object" ? user : null;
  } catch {
    localStorage.removeItem("shopmart_user");
    localStorage.removeItem("shopmart_token");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  const saveSession = (session) => {
    setUser(session);
    localStorage.setItem("shopmart_user", JSON.stringify(session));
    localStorage.setItem("shopmart_token", session.token);
  };

  const updateUser = useCallback((updates) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...updates };
      localStorage.setItem("shopmart_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    saveSession(data);
    return data;
  };

  const googleLogin = async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    saveSession(data);
    return data;
  };

  const registerUser = async (userData) => {
    const { data } = await api.post("/auth/register", userData);
    if (data.token) saveSession(data);
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("shopmart_user");
    localStorage.removeItem("shopmart_token");
  };

  return (
    <AuthContext.Provider
      value={{ user, login, googleLogin, registerUser, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
