import { createI18n } from 'vue-i18n';
import en from './en.json';
import zh from './zh.json';

const messages = {
    en,
    zh,
};

export const i18n = createI18n({
    locale: 'en',
    messages,
});
