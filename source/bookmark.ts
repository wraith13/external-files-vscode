import * as vscode from "vscode";
import * as vscel from '@wraith13/vscel';
import { File } from "./file";
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
    // Regarding the processing of addFolder, addFile, and removeFolderOrFile:
    // Since the file object pointed to by a URI can change from a file to a folder or from a folder to a file due to user actions,
    // such redundant processing is necessary, and it is not possible to provide processing like removeFolder or removeFile.
    export const addFolder = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key] ?? blankEntry();
        entry.folders = entry.folders.filter(i => i.toString() !== document.toString());
        entry.folders.unshift(document);
        entry.folders.sort();
        entry.files = entry.files.filter(i => i.toString() !== document.toString());
        bookmark[key] = entry;
        return bookmark;
    };
    export const addFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key] ?? blankEntry();
        entry.folders = entry.folders.filter(i => i.toString() !== document.toString());
        entry.files = entry.files.filter(i => i.toString() !== document.toString());
        entry.files.unshift(document);
        entry.files.sort();
        bookmark[key] = entry;
        return bookmark;
    };
    export const removeFolderOrFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key];
        if (entry)
        {
            entry.folders = entry.folders.filter(i => i.toString() !== document.toString());
            entry.files = entry.files.filter(i => i.toString() !== document.toString());
            bookmark[key] = entry;
        }
        return bookmark;
    };
    export const regulateBookmark = (bookmark: LiveType): LiveType =>
    {
        const regulated: LiveType = {};
        for (const [key, value] of Object.entries(bookmark).sort(vscel.comparer.make(i => regulateKey(i[0]))))
        {
            const regulatedKey = regulateKey(key);
            regulated[regulatedKey] = blankEntry();
            regulated[regulatedKey].folders = value.folders
                .filter
                (
                    (i, ix, list) =>
                    list.findIndex(t => t.toString() === i.toString()) === ix
                )
                .sort
                (
                    vscel.comparer.make
                    ([
                        i => File.stripFileName(i.fsPath),
                        i => File.stripFileName(i.path),
                        i => i.toString(),
                    ])
                );
            regulated[regulatedKey].files = value.files
                .filter
                (
                    (i, ix, list) =>
                    list.findIndex(t => t.toString() === i.toString()) === ix
                )
                .sort
                (
                    vscel.comparer.make
                    ([
                        i => File.stripFileName(i.fsPath),
                        i => File.stripFileName(i.path),
                        i => i.toString(),
                    ])
                );
        }
        return regulated;
    };
    export class Instance
    {
        constructor(public uriPrefix: string, public getFromStorage: () => JsonType, public setToStorage: (bookmark: JsonType) => Thenable<void>)
        {
        }
        public get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(this.getFromStorage());
        public set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            this.setToStorage(Bookmark.liveToJson(Bookmark.regulateBookmark(bookmark)));
        public clear = (): Thenable<void> =>
            this.setToStorage({});
        public addKey = (key: string): Thenable<void> =>
            this.set(Bookmark.addKey(this.get(), key));
        public removeKey = (key: string): Thenable<void> =>
            this.set(Bookmark.removeKey(this.get(), key));
        public addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.addFolder(this.get(), key, document));
        public addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.addFile(this.get(), key, document));
        public removeFolderOrFile = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.removeFolderOrFile(this.get(), key, document));
        public getUri = (key: string): vscode.Uri =>
            vscode.Uri.parse(`${this.uriPrefix}${encodeURIComponent(key)}`);
        public getKeyFromUri = (uri: vscode.Uri): string | undefined =>
            uri.toString().startsWith(this.uriPrefix.toLowerCase()) ?
                decodeURIComponent(uri.toString().substring(this.uriPrefix.length)):
                undefined;
    }
}
