"use client";

import { createContext, useContext, useCallback } from "react";
import { Lang, TRANSLATIONS } from "@/lib/i18n/translations";

interface LangContextType {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (key: string) => string;
}

export const LangContext = createContext<LangContextType>({
  lang: "ar",
  dir: "rtl",
  t: (k) => k,
});

export function useLang() {
  return useContext(LangContext);
}

export function createTranslator(lang: Lang) {
  return (key: string): string =>
    (TRANSLATIONS[lang] as Record<string, string>)?.[key] ??
    (TRANSLATIONS["ar"] as Record<string, string>)?.[key] ??
    key;
}
