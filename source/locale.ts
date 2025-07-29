import * as vscel from '@wraith13/vscel';
import localeEn from "../package.nls.json";
import localeCs from "../package.nls.cs.json";
import localeDe from "../package.nls.de.json";
import localeEs from "../package.nls.es.json";
import localeFr from "../package.nls.fr.json";
import localeHu from "../package.nls.hu.json";
import localeIt from "../package.nls.it.json";
import localeJa from "../package.nls.ja.json";
import localeKo from "../package.nls.ko.json";
import localePl from "../package.nls.pl.json";
import localePtBr from "../package.nls.pt-br.json";
import localeRu from "../package.nls.ru.json";
import localeTr from "../package.nls.tr.json";
import localeZhCn from "../package.nls.zh-cn.json";
import localeZhTw from "../package.nls.zh-tw.json";
export type LocaleKeyType = keyof typeof localeEn;
export const locale = vscel.locale.make
(
    localeEn,
    {
        "en": localeEn,
        "cs": localeCs,
        "de": localeDe,
        "es": localeEs,
        "fr": localeFr,
        "hu": localeHu,
        "it": localeIt,
        "ja": localeJa,
        "ko": localeKo,
        "pl": localePl,
        "pt-br": localePtBr,
        "ru": localeRu,
        "tr": localeTr,
        "zh-cn": localeZhCn,
        "zh-tw": localeZhTw,
    }
);
