import * as vscode from 'vscode';
import { String } from "./string";
import packageJson from "../package.json";
export namespace Application
{
    export let context: vscode.ExtensionContext;
    export const publisher = packageJson.publisher;
    export const key = packageJson.name;
    export const makeKey = (name: string): string =>
        `${publisher}.${key}.${name}`;
    export const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    export const isExternalFiles = (uri: vscode.Uri): boolean =>
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => String.makeSureEndWithSlash(uri.path).startsWith(String.makeSureEndWithSlash(i.uri.path))).length;
    export const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
}
