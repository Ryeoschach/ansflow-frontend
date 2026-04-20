import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCN from './zh-CN.json';
import enUS from './en-US.json';

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
};

// 从 localStorage 读取保存的语言，与 Zustand persist 的 key 一致
const getSavedLang = (): string => {
  try {
    const raw = localStorage.getItem('ansflow-app');
    if (raw) {
      const state = JSON.parse(raw);
      if (state.state?.language) return state.state.language;
    }
  } catch {}
  return 'zh-CN';
};

const savedLang = getSavedLang();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: savedLang,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
