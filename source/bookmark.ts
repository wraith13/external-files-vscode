import * as vscode from "vscode";
export namespace Bookmark
{
    export type JsonType = { [key: string]: { folders: string[]; files: string[]; } };
    export type LiveType = { [key: string]: { folders: vscode.Uri[]; files: vscode.Uri[]; } };
    export const regulateKey = (key: string): string =>
        key.trim().replace(/[\s]+/g, " ");
    export const blankEntry = (): LiveType[string] => ({ folders: [], files: [] });
    export const jsonToLive = (json: JsonType): LiveType =>
        Object.entries(json).reduce
        (
            (acc, [key, value]) =>
            ({
                ...acc,
                [key]:
                {
                    folders: value.folders.map(i => vscode.Uri.parse(i)),
                    files: value.files.map(i => vscode.Uri.parse(i)),
                }
            }),
            {}
        );
    export const liveToJson = (live: LiveType): JsonType =>
        Object.entries(live).reduce
        (
            (acc, [key, value]) =>
            ({
                ...acc,
                [key]:
                {
                    folders: value.folders.map(i => i.toString()),
                    files: value.files.map(i => i.toString()),
                }
            }),
            {}
        );
    export const addKey = (bookmark: LiveType, key: string): LiveType =>
    {
        bookmark[key] = bookmark[key] ?? blankEntry();
        return bookmark;
    };
    export const addFolder = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key] ?? blankEntry();
        let current = entry.folders;
        current = current.filter(i => i.toString() !== document.toString());
        current.unshift(document);
        current.sort();
        entry.folders = current;
        bookmark[key] = entry;
        return bookmark;
    };
    export const removeFolder = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key];
        if (entry)
        {
            let current = entry.folders;
            current = current.filter(i => i.toString() !== document.toString());
            current.sort();
            entry.folders = current;
            bookmark[key] = entry;
        }
        return bookmark;
    };
    export const addFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key] ?? blankEntry();
        let current = entry.files;
        current = current.filter(i => i.toString() !== document.toString());
        current.unshift(document);
        current.sort();
        entry.files = current;
        bookmark[key] = entry;
        return bookmark;
    };
    export const removeFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key];
        if (entry)
        {
            let current = entry.files;
            current = current.filter(i => i.toString() !== document.toString());
            current.sort();
            entry.files = current;
            bookmark[key] = entry;
        }
        return bookmark;
    };
}
