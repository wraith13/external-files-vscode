import * as vscode from "vscode";
import * as vscel from '@wraith13/vscel';
import { Application } from './application';
import { File } from "./file";
import { Config } from './config';
export namespace Favorites
{
    const stateKey = Application.makeKey("favorites");
    export const uriPrefix = `${Application.publisher}.${Application.key}://favorites/`;
    export type JsonType = string[];
    export type LiveType = vscode.Uri[];
    export type ItemType = vscode.Uri;
    export const clear = (): Thenable<void> =>
        Config.favoritesScope.get().getState().update(stateKey, []);
    export const get = (): LiveType =>
        Config.favoritesScope.get().getState().get<JsonType>(stateKey, [])
        .map(i => vscode.Uri.parse(i));
    export const set = (data: LiveType): Thenable<void> =>
        Config.favoritesScope.get().getState().update(stateKey, data.map(i => i.toString()));
    const removeItem = (data: LiveType, document: ItemType): LiveType =>
        data.filter(i => i.toString() !== document.toString());
    export const sorter = vscel.comparer.make<vscode.Uri>
    ([
        i => File.stripFileName(i.fsPath),
        i => File.stripFileName(i.path),
        i => i.toString(),
    ]);
    const regulateData = (data: LiveType): LiveType =>
        data.sort(sorter);
    export const add = (document: ItemType): Thenable<void> =>
    {
        let current = get();
        current = removeItem(current, document);
        current.unshift(document);
        current = regulateData(current);
        return set(current);
    };
    export const remove = (document: ItemType): Thenable<void> =>
        set(removeItem(get(), document));
    export const regulate = (): Thenable<void> =>
        set(regulateData(get()));
    export const getUri = (): vscode.Uri =>
        vscode.Uri.parse(uriPrefix);
    export const getEntries = async (data: LiveType): Promise<{ folders: vscode.Uri[]; files: vscode.Uri[]; unknowns: vscode.Uri[]; }> =>
        await File.classifyUris(data);
    export const onDidChangeUri = (oldUri: vscode.Uri, newUri: vscode.Uri | "removed"): boolean =>
    {
        const current = get();
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
            set(regulateData(current));
            return true;
        }
        return false;
    };
}
