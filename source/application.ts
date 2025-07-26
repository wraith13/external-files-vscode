import * as vscode from 'vscode';
import packageJson from "../package.json";
export namespace Application
{
    export let context: vscode.ExtensionContext;
    export const publisher = packageJson.publisher;
    export const key = packageJson.name;
    export const makeKey = (name: string): string =>
        `${publisher}.${key}.${name}`;
}
