"use client";

import { createContext, useContext } from "react";
import { User } from "@/lib/db/database";

interface AuthContextType {
  user: User | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
