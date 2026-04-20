"use client";

import { createContext, useContext } from "react";
import { User } from "@/lib/db/database";
import { Permission, hasPermission } from "@/lib/engine/permissions";

interface AuthContextType {
  user: User | null;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: () => {},
  can: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}
