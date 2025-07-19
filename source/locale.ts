import * as vscel from '@wraith13/vscel';
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
export type LocaleKeyType = keyof typeof localeEn;
export const locale = vscel.locale.make(localeEn, { "ja": localeJa });
