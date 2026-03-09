/* eslint-disable react-refresh/only-export-components */
import type { ComponentType, ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import type { Language, Translations } from "../utils/translations";
import {
  getTranslationValue,
  getTranslationsForLanguage,
} from "../utils/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: Translations;
  t: (key: string) => string;
}

const defaultContext: LanguageContextType = {
  language: "ja", // Default to Japanese
  setLanguage: () => {},
  t: (key) => key,
  translations: {},
};

const LanguageContext = createContext<LanguageContextType>(defaultContext);

export const useLanguage = () => useContext(LanguageContext);

// HOC to inject language props into class components
export function withLanguage<P extends object>(
  Component: ComponentType<P & { t: (key: string) => string }>,
): React.FC<P> {
  return (props: P) => {
    const { t } = useLanguage();
    return <Component {...props} t={t} />;
  };
}

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  // Get initial language from localStorage or browser settings
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      let savedLanguage: string | null = null;
      try {
        savedLanguage = window.localStorage.getItem("language");
      } catch {
        savedLanguage = null;
      }
      if (savedLanguage && (savedLanguage === "en" || savedLanguage === "ja")) {
        return savedLanguage;
      }

      // Try to detect browser language
      const browserLang = window.navigator.language.slice(0, 2);
      return browserLang === "ja" ? "ja" : "en";
    }

    return "ja";
  });

  // Get translations for the current language
  const translations = getTranslationsForLanguage(language);

  // Set language and save to localStorage
  const setLanguage = (newLanguage: Language) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("language", newLanguage);
      } catch {
        // Ignore storage write failures in restricted environments.
      }
    }
    setLanguageState(newLanguage);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", newLanguage);
    }
  };

  // Set the initial language attribute on the document
  useEffect(() => {
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    return getTranslationValue(translations, key) || key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, translations }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
