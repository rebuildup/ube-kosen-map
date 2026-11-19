export type Language = "en" | "ja";

export interface Translations {
  [key: string]: string | Translations;
}

export const enTranslations: Translations = {
  map: {
    enterFullscreen: "Enter Fullscreen",
    exitFullscreen: "Exit Fullscreen",
  },
};

export const jaTranslations: Translations = {
  map: {
    enterFullscreen: "全画面表示",
    exitFullscreen: "全画面を終了",
  },
};

// Function to get translations for a language
export const getTranslationsForLanguage = (
  language: Language,
): Translations => {
  return language === "en" ? enTranslations : jaTranslations;
};

// Function to get a nested value from translations using dot notation
export const getTranslationValue = (
  translations: Translations,
  key: string,
): string => {
  const keys = key.split(".");
  let result: Translations | string = translations;

  for (const k of keys) {
    if (typeof result === "object" && result !== null) {
      const value: string | Translations | undefined = (result as Translations)[
        k
      ];
      if (value === undefined) {
        return key; // Return the key if the translation is not found
      }
      result = value;
    } else {
      return key; // Return the key if the translation is not found
    }
  }

  return typeof result === "string" ? result : key;
};
