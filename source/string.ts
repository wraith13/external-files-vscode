export namespace String
{
    export const regulateName = (key: string): string =>
        key.trim().replace(/[\s]+/g, " ");
    export const makeSureEndWithSlash = (path: string): string =>
        path.endsWith("/") ? path : path + "/";
}
