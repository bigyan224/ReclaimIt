import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations } from "./translations";

const STORAGE_KEY = "app_language";
const DEFAULT_LANGUAGE = "en";

const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
  isHydrated: false,
});

function getValueByPath(obj, key) {
  return key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function interpolate(template, params) {
  if (typeof template !== "string") return template;
  if (!params) return template;

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token) => {
    const value = params[token];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && savedLanguage && translations[savedLanguage]) {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        console.error("Failed to load language setting:", error);
      } finally {
        if (mounted) setIsHydrated(true);
      }
    };

    loadLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    if (!translations[nextLanguage]) return;

    setLanguageState(nextLanguage);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.error("Failed to persist language setting:", error);
    }
  }, []);

  const t = useCallback(
    (key, params) => {
      const fromSelected = getValueByPath(translations[language], key);
      const fromDefault = getValueByPath(translations[DEFAULT_LANGUAGE], key);
      const resolved = fromSelected ?? fromDefault ?? key;
      return interpolate(resolved, params);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isHydrated,
    }),
    [language, setLanguage, t, isHydrated]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
