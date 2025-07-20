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
    export const removeKey = (bookmark: LiveType, key: string): LiveType =>
    {
        delete bookmark[key];
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
    export class Instance
    {
        constructor(public uriPrefix: string, public getFromStorage: () => JsonType, public setToStorage: (bookmark: JsonType) => Thenable<void>)
        {
        }
        public get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(this.getFromStorage());
        public set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            this.setToStorage(Bookmark.liveToJson(bookmark));
        public addKey = (key: string): Thenable<void> =>
            this.set(Bookmark.addKey(this.get(), key));
        public removeKey = (key: string): Thenable<void> =>
            this.set(Bookmark.removeKey(this.get(), key));
        public addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.addFolder(this.get(), key, document));
        public removeFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.removeFolder(this.get(), key, document));
        public addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.addFile(this.get(), key, document));
        public removeFile = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.removeFile(this.get(), key, document));
        public getUri = (key: string): vscode.Uri =>
            vscode.Uri.parse(`${this.uriPrefix}${encodeURIComponent(key)}`);
        public getKeyFromUri = (uri: vscode.Uri): string | undefined =>
            uri.path.startsWith(this.uriPrefix) ?
                decodeURIComponent(uri.path.substring(this.uriPrefix.length)):
                undefined;
    }
}
