import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCN from './zh-CN.json';
import enUS from './en-US.json';

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
};

// 默认语言
const DEFAULT_LANG = 'zh-CN';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
