import * as vscode from "vscode";
import * as vscel from '@wraith13/vscel';
import { Application } from './application';
import { regulateName } from "./regulate-name";
import { File } from "./file";
export namespace Bookmark
{
    export type JsonType = { [key: string]: string[]; };
    export type LiveType = { [key: string]: vscode.Uri[]; };
    export const blankEntry = (): LiveType[string] => [];
    export const jsonToLive = (json: JsonType): LiveType =>
        Object.entries(json).reduce
        (
            (acc, [key, value]) =>
            ({
                ...acc,
                [key]: value.map(i => vscode.Uri.parse(i)),
            }),
            {}
        );
    export const liveToJson = (live: LiveType): JsonType =>
        Object.entries(live).reduce
        (
            (acc, [key, value]) =>
            ({
                ...acc,
                [key]: value.map(i => i.toString()),
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
    export const addEntry = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key] ?? blankEntry();
        entry = entry.filter(i => i.toString() !== document.toString());
        entry.unshift(document);
        entry.sort();
        bookmark[key] = entry;
        return bookmark;
    };
    export const removeEntry = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
    {
        let entry = bookmark[key];
        if (entry)
        {
            bookmark[key] = entry.filter(i => i.toString() !== document.toString());
        }
        return bookmark;
    };
    export const regulateBookmark = (bookmark: LiveType): LiveType =>
    {
        const regulated: LiveType = {};
        for (const [key, value] of Object.entries(bookmark).sort(vscel.comparer.make(i => regulateName(i[0]))))
        {
            const regulatedKey = regulateName(key);
            regulated[regulatedKey] = blankEntry();
            regulated[regulatedKey] = value
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
    export const getEntries = async (bookmark: LiveType, key: string): Promise<{ folders: vscode.Uri[]; files: vscode.Uri[]; unknowns: vscode.Uri[]; }> =>
    {
        const entries = bookmark[key] ?? [];
        const folders: vscode.Uri[] = [];
        const files: vscode.Uri[] = [];
        const unknowns: vscode.Uri[] = [];
        await Promise.all
        (
            entries.map
            (
                async entry =>
                {
                    switch(await File.isFolderOrFile(entry))
                    {
                    case "folder":
                        folders.push(entry);
                        break;
                    case "file":
                        files.push(entry);
                        break;
                    default:
                        unknowns.push(entry);
                        break;
                    }
                }
            )
        );
        return { folders, files, unknowns };
    };
    export const onDidChangeUri = (bookmark: LiveType, oldUri: vscode.Uri, newUri: vscode.Uri | "removed"): boolean =>
    {
        let result = false;
        Object.values(bookmark).forEach
        (
            current =>
            {
                const index = current.findIndex(i => i.toString() === oldUri.toString());
                if (0 <= index)
                {
                    if ("removed" === newUri)
                    {
                        current.splice(index, 1);
                    }
                    else
                    {
                        current[index] = newUri;
                    }
                    result = true;
                }
            }
        );
        return result;
    }
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
        public addEntry = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.addEntry(this.get(), key, document));
        public removeEntry = (key: string, document: vscode.Uri): Thenable<void> =>
            this.set(Bookmark.removeEntry(this.get(), key, document));
        public getUri = (key: string): vscode.Uri =>
            vscode.Uri.parse(`${this.uriPrefix}${encodeURIComponent(key)}`);
        public getKeyFromUri = (uri: vscode.Uri): string | undefined =>
            uri.toString().startsWith(this.uriPrefix.toLowerCase()) ?
                decodeURIComponent(uri.toString().substring(this.uriPrefix.length)):
                undefined;
        public getEntries = async (key: string): Promise<{ folders: vscode.Uri[]; files: vscode.Uri[]; unknowns: vscode.Uri[]; }> =>
            await Bookmark.getEntries(this.get(), key);
        public onDidChangeUri = (oldUri: vscode.Uri, newUri: vscode.Uri | "removed"): boolean =>
        {
            const bookmark = this.get();
            const result = Bookmark.onDidChangeUri(bookmark, oldUri, newUri);
            if (result)
            {
                this.set(bookmark);
            }
            return result;
        }
    }
    export namespace GlobalBookmark
    {
        export const stateKey = Application.makeKey("globalBookmark");
        export const uriPrefix = `${Application.publisher}.${Application.key}://global-bookmark/`;
        export const instance = new Bookmark.Instance
        (
            uriPrefix,
            () => Application.context.globalState.get<Bookmark.JsonType>(stateKey, {}),
            (bookmark: Bookmark.JsonType) => Application.context.globalState.update(stateKey, bookmark)
        );
    }
    export const global = GlobalBookmark.instance;
    export namespace WorkspaceBookmark
    {
        export const stateKey = Application.makeKey("workspaceBookmark");
        export const uriPrefix = `${Application.publisher}.${Application.key}://workspace-bookmark/`;
        export const instance = new Bookmark.Instance
        (
            uriPrefix,
            () => Application.context.workspaceState.get<Bookmark.JsonType>(stateKey, {}),
            (bookmark: Bookmark.JsonType) => Application.context.workspaceState.update(stateKey, bookmark)
        );
    }
    export const workspace = WorkspaceBookmark.instance;
}
