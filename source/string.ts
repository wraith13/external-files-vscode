export namespace String
{
    export const regulateName = (key: string): string =>
        key.trim().replace(/[\s]+/g, " ");
    export const makeSureEndWithSlash = (path: string): string =>
        path.endsWith("/") ? path : path + "/";
    export const isValid = (text: any): text is string =>
        "string" === typeof text && 0 < text.length;
}
