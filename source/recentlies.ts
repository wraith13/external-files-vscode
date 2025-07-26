import * as vscode from "vscode";
import { Application } from './application';
import { Config } from './config';
export namespace Recentlies
{
    const stateKey = Application.makeKey("recentlyUsedExternalFiles");
    export const uriPrefix = `${Application.publisher}.${Application.key}://recently-used-external-files/`;
    export type JsonType = string[];
    export type LiveType = vscode.Uri[];
    export type ItemType = vscode.Uri;
    export const clear = (): Thenable<void> =>
        Application.context.workspaceState.update(stateKey, []);
    export const get = (): LiveType =>
        Application.context.workspaceState.get<JsonType>(stateKey, [])
        .map(i => vscode.Uri.parse(i));
    export const set = (documents: LiveType): Thenable<void> =>
        Application.context.workspaceState.update(stateKey, documents.map(i => i.toString()));
    const removeItem = (data: LiveType, document: ItemType): LiveType =>
        data.filter(i => i.toString() !== document.toString());
    const regulateData = (data: LiveType): LiveType =>
        data.slice(0, Config.maxRecentlyFiles.get("root-workspace"));
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
            set(current);
            return true;
        }
        return false;
    }
}
