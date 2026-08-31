import { createContext, useCallback, useContext, useMemo } from "react";
import { translations } from "./translations";

const DEFAULT_LANGUAGE = "en";

const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
  isHydrated: true,
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
  const language = DEFAULT_LANGUAGE;
  const setLanguage = useCallback(() => {}, []);
  const isHydrated = true;

  const t = useCallback(
    (key, params) => {
      const resolved = getValueByPath(translations[DEFAULT_LANGUAGE], key) ?? key;
      return interpolate(resolved, params);
    },
    []
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isHydrated,
    }),
    [t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
