import * as vscode from "vscode";
export namespace Icons
{
    export let folder: vscode.IconPath;
    export let file: vscode.IconPath;
    export let error: vscode.IconPath;
    export let star: vscode.IconPath;
    export let bookmark: vscode.IconPath;
    export let pin: vscode.IconPath;
    export let history: vscode.IconPath;
    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        folder = vscode.ThemeIcon.Folder;
        file = vscode.ThemeIcon.File;
        error = new vscode.ThemeIcon("error");
        star =
        {
            light: vscode.Uri.joinPath(context.extensionUri, "images", "star.1024.svg"),
            dark: vscode.Uri.joinPath(context.extensionUri, "images", "star-white.1024.svg"),
        };
        bookmark =
        {
            light: vscode.Uri.joinPath(context.extensionUri, "images", "bookmark.1024.svg"),
            dark: vscode.Uri.joinPath(context.extensionUri, "images", "bookmark-white.1024.svg"),
        };
        pin =
        {
            light: vscode.Uri.joinPath(context.extensionUri, "images", "pin.1024.svg"),
            dark: vscode.Uri.joinPath(context.extensionUri, "images", "pin-white.1024.svg"),
        };
        history =
        {
            light: vscode.Uri.joinPath(context.extensionUri, "images", "history.1024.svg"),
            dark: vscode.Uri.joinPath(context.extensionUri, "images", "history-white.1024.svg"),
        };
    };
}
