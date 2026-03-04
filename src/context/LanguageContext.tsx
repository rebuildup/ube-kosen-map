/* eslint-disable react-refresh/only-export-components */
import type { ComponentType, ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import type { Language, Translations } from "../utils/translations";
import { getTranslationsForLanguage, getTranslationValue } from "../utils/translations";

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
    const savedLanguage = localStorage.getItem("language") as Language;
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "ja")) {
      return savedLanguage;
    }

    // Try to detect browser language
    const browserLang = navigator.language.slice(0, 2);
    return browserLang === "ja" ? "ja" : "en";
  });

  // Get translations for the current language
  const translations = getTranslationsForLanguage(language);

  // Set language and save to localStorage
  const setLanguage = (newLanguage: Language) => {
    localStorage.setItem("language", newLanguage);
    setLanguageState(newLanguage);
    document.documentElement.setAttribute("lang", newLanguage);
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
    <LanguageContext.Provider value={{ language, setLanguage, t, translations }}>
      {children}
    </LanguageContext.Provider>
  );
};
