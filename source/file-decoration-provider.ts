import * as vscode from "vscode";
import { locale } from "./locale";
export class ErrorDecorationProvider implements vscode.FileDecorationProvider
{
    private onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this.onDidChange.event;
    provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration>
    {
        if (this.errorUris.includes(uri.toString()))
        {
            const result = new vscode.FileDecoration
            (
                "!",
                locale.map("error.access"),
                new vscode.ThemeColor("problemsErrorIcon.foreground")
            );
            return result;
        }
        return undefined;
    }
    errorUris: string[] = [];
    hasErrorUri(uri: vscode.Uri): boolean
    {
        return this.errorUris.includes(uri.toString());
    }
    clearErrorUris(): void
    {
        const uris = this.errorUris;
        this.errorUris = [];
        this.onDidChange.fire(uris.map(i => vscode.Uri.parse(i)));
    }
    addErrorUri(uri: vscode.Uri): void
    {
        if ( ! this.errorUris.includes(uri.toString()))
        {
            this.errorUris.push(uri.toString());
            this.onDidChange.fire(uri);
        }
    }
    addErrorUris(uris: vscode.Uri[]): void
    {
        uris.forEach(uri => this.addErrorUri(uri));
    }
    removeErrorUri(uri: vscode.Uri): void
    {
        const index = this.errorUris.indexOf(uri.toString());
        if (0 <= index)
        {
            this.errorUris.splice(index, 1);
            this.onDidChange.fire(uri);
        }
    }
    removeErrorUris(uris: vscode.Uri[]): void
    {
        uris.forEach(uri => this.removeErrorUri(uri));
    }
}
export const errorDecorationProvider = new ErrorDecorationProvider();
