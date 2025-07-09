'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const configRoot = vscel.config.makeRoot(packageJson);
export const maxRecentlyFiles = configRoot.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
export type LocaleKeyType = keyof typeof localeEn;
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
export namespace ExternalFiles
{
    const publisher = packageJson.publisher;
    const applicationKey = packageJson.name;
    const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    const isExternalFiles = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && 0 === (vscode.workspace.workspaceFolders ?? []).filter(i => document.uri.path.startsWith(i.uri.path)).length;
    const recentlyUsedExternalDocumentsKey = `${publisher}.${applicationKey}.recentlyUsedExternalDocuments`;
    const clearRecentlyUsedExternalDocuments = (): Thenable<void> =>
        extensionContext.workspaceState.update(recentlyUsedExternalDocumentsKey, []);
    const getRecentlyUsedExternalDocuments = (): vscode.Uri[] =>
        extensionContext.workspaceState.get<string[]>(recentlyUsedExternalDocumentsKey, [])
        .map(i => vscode.Uri.parse(i));
    const setRecentlyUsedExternalDocuments = (documents: vscode.Uri[]): Thenable<void> =>
        extensionContext.workspaceState.update(recentlyUsedExternalDocumentsKey, documents.map(i => i.toString()));
    const addRecentlyUsedExternalDocument = (document: vscode.Uri): Thenable<void> =>
    {
        let current = getRecentlyUsedExternalDocuments();
        current = current.filter(i => i.toString() !== document.toString());
        current.unshift(document);
        current = current.slice(0, maxRecentlyFiles.get("root-workspace"));
        return setRecentlyUsedExternalDocuments(current);
    };
    const pinnedExternalDocumentsKey = `${publisher}.${applicationKey}.pinnedExternalDocuments`;
    const getPinnedExternalDocuments = (): vscode.Uri[] =>
        extensionContext.workspaceState.get<string[]>(pinnedExternalDocumentsKey, [])
        .map(i => vscode.Uri.parse(i));
    const setPinnedExternalDocuments = (documents: vscode.Uri[]): Thenable<void> =>
        extensionContext.workspaceState.update(pinnedExternalDocumentsKey, documents.map(i => i.toString()));
    const isPinnedExternalDocument = (document: vscode.Uri): boolean =>
        getPinnedExternalDocuments().some(i => i.toString() === document.toString());
    const addPinnedExternalDocument = (document: vscode.Uri): Thenable<void> =>
    {
        let current = getPinnedExternalDocuments();
        current = current.filter(i => i.toString() !== document.toString());
        current.unshift(document);
        current.sort();
        return setPinnedExternalDocuments(current);
    };
    const removePinnedExternalDocument = (document: vscode.Uri): Thenable<void> =>
    {
        let current = getPinnedExternalDocuments();
        current = current.filter(i => i.toString() !== document.toString());
        return setPinnedExternalDocuments(current);
    };
    class ExternalFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem>
    {
        private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
        readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        getChildren(_element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]>
        {
            const externalDocuments = getRecentlyUsedExternalDocuments();
            return 0 < externalDocuments.length ?
                externalDocuments.map
                (
                    i =>
                    ({
                        label: stripDirectory(i.fsPath),
                        resourceUri: i,
                        description: stripFileName(i.fsPath),
                        command:
                        {
                            title: "show",
                            command: "vscode.open",
                            arguments:[i]
                        }
                    })
                ):
                [{
                    label: locale.map("noExternalFiles.message"),
                }];
        }
        update = () => this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }
    let unsavedFilesProvider = new ExternalFilesProvider();
    export namespace Config
    {
        const root = vscel.config.makeRoot(packageJson);
        export namespace ViewOnExplorer
        {
            export const enabled = root.makeEntry<boolean>("external-files.viewOnExplorer.enabled", "root-workspace");
        }
    }
    const showTextDocument = async (textDocument: vscode.Uri): Promise<vscode.TextEditor> => await vscode.window.showTextDocument
    (
        textDocument,
        undefined
    );
    export const makeCommand = (command: string, withActivate?: "withActivate") =>
        async (node: any) =>
        {
            if (withActivate)
            {
                await vscode.commands.executeCommand("vscode.open", node.resourceUri);
            }
            await vscode.commands.executeCommand(command, node.resourceUri);
        };
    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        const showCommandKey = `${applicationKey}.show`;
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(showCommandKey, show),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.copyRelativeFilePath`, makeCommand("copyRelativeFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.compareFileWith`, makeCommand("workbench.files.action.compareFileWith", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.compareWithClipboard`, makeCommand("workbench.files.action.compareWithClipboard", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.compareWithSaved`, makeCommand("workbench.files.action.compareWithSaved")),
            vscode.commands.registerCommand(`${applicationKey}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.showView`, showView),
            vscode.commands.registerCommand(`${applicationKey}.hideView`, hideView),
            //  TreeDataProovider の登録
            vscode.window.registerTreeDataProvider(applicationKey, unsavedFilesProvider),
            //  イベントリスナーの登録
            vscode.window.onDidChangeActiveTextEditor(a => a && isRegularTextEditor(a) && updateExternalDocuments(a.document)),
            //vscode.workspace.onDidOpenTextDocument(a => updateExternalDocuments(a)),
            vscode.workspace.onDidChangeConfiguration
            (
                event =>
                {
                    if (event.affectsConfiguration("external-files"))
                    {
                        onDidChangeConfiguration();
                    }
                }
            )
        );
        clearRecentlyUsedExternalDocuments();
        updateViewOnExplorer();
        unsavedFilesProvider.update();
    };
    const updateExternalDocuments = async (document: vscode.TextDocument) =>
    {
        if (isExternalFiles(document))
        {
            await addRecentlyUsedExternalDocument(document.uri);
            unsavedFilesProvider.update();
        }
    };
    const onDidChangeConfiguration = (): void =>
    {
        updateViewOnExplorer();
    };
    const updateViewOnExplorer = (): void =>
    {
        vscode.commands.executeCommand
        (
            "setContext",
            "showExternalFilesViewOnexplorer",
            Config.ViewOnExplorer.enabled.get("default-scope")
        );
    };
    const showNoExternalFilesMessage = async () => await vscode.window.showInformationMessage(locale.map("noExternalFiles.message"));
    const stripFileName = (path: string): string =>
        path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path: string): string =>
        path.split('\\').reverse()[0].split('/').reverse()[0];
    const showQuickPickUnsavedDocument = () => vscode.window.showQuickPick
    (
        getRecentlyUsedExternalDocuments().map
        (
            i =>
            ({
                label: `$(primitive-dot) $(file-text) ${stripDirectory(i.fsPath)}`,
                description: stripFileName(i.fsPath),
                document: i
            })
        ),
        {
            placeHolder: locale.map("selectExternalFiles.placeHolder"),
        }
    );
    export const show = async (): Promise<void> =>
    {
        const externalDocuments = getRecentlyUsedExternalDocuments();
        switch(externalDocuments.length)
        {
        case 0:
            await showNoExternalFilesMessage();
            break;
        case 1:
            await showTextDocument(externalDocuments[0]);
            break;
        default:
            const selected = await showQuickPickUnsavedDocument();
            if (selected)
            {
                await showTextDocument(selected.document);
            }
            break;
        }
    };
    const showView = async (): Promise<void> => await Config.ViewOnExplorer.enabled.set(true);
    const hideView = async (): Promise<void> => await Config.ViewOnExplorer.enabled.set(false);
}
let extensionContext: vscode.ExtensionContext;
export const activate = (context: vscode.ExtensionContext) : void =>
{
    extensionContext = context;
    ExternalFiles.initialize(context);
};
export const deactivate = () : void =>
{
};
