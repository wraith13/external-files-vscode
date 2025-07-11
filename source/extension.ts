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
    namespace PinnedExternalFiles
    {
        const key = `${publisher}.${applicationKey}.pinnedExternalFiles`;
        export const get = (): vscode.Uri[] =>
            extensionContext.workspaceState.get<string[]>(key, [])
            .map(i => vscode.Uri.parse(i));
        export const set = (documents: vscode.Uri[]): Thenable<void> =>
            extensionContext.workspaceState.update(key, documents.map(i => i.toString()));
        export const isPinned = (document: vscode.Uri): boolean =>
            get().some(i => i.toString() === document.toString());
        export const add = (document: vscode.Uri): Thenable<void> =>
        {
            let current = get();
            current = current.filter(i => i.toString() !== document.toString());
            current.unshift(document);
            current.sort();
            return set(current);
        };
        export const remove = (document: vscode.Uri): Thenable<void> =>
        {
            let current = get();
            current = current.filter(i => i.toString() !== document.toString());
            return set(current);
        };
    }
    namespace RecentlyUsedExternalFiles
    {
        const key = `${publisher}.${applicationKey}.recentlyUsedExternalFiles`;
        export const clear = (): Thenable<void> =>
            extensionContext.workspaceState.update(key, []);
        export const get = (): vscode.Uri[] =>
            extensionContext.workspaceState.get<string[]>(key, [])
            .map(i => vscode.Uri.parse(i));
        export const set = (documents: vscode.Uri[]): Thenable<void> =>
            extensionContext.workspaceState.update(key, documents.map(i => i.toString()));
        export const add = (document: vscode.Uri): Thenable<void> =>
        {
            let current = get();
            current = current.filter(i => i.toString() !== document.toString());
            current.unshift(document);
            current = current.slice(0, maxRecentlyFiles.get("root-workspace"));
            return set(current);
        };
        export const remove = (document: vscode.Uri): Thenable<void> =>
        {
            let current = get();
            current = current.filter(i => i.toString() !== document.toString());
            return set(current);
        };
    }
    namespace Icons
    {
        export let pinIcon: vscode.IconPath;
        export let historyIcon: vscode.IconPath;
        export const initialize = (context: vscode.ExtensionContext): void =>
        {
            pinIcon =
            {
                light: vscode.Uri.joinPath(context.extensionUri, "images", "pin.1024.svg"),
                dark: vscode.Uri.joinPath(context.extensionUri, "images", "pin-white.1024.svg"),
            };
            historyIcon =
            {
                light: vscode.Uri.joinPath(context.extensionUri, "images", "history.1024.svg"),
                dark: vscode.Uri.joinPath(context.extensionUri, "images", "history-white.1024.svg"),
            };
        };
    }
    class ExternalFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem>
    {
        private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
        readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]>
        {
            switch(element?.contextValue)
            {
            case undefined:
                return [
                    {
                        iconPath: Icons.pinIcon,
                        label: locale.map("external-files-vscode.pinnedExternalFiles"),
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        contextValue: `${publisher}.${applicationKey}.pinnedExternalFilesRoot`,
                    },
                    {
                        iconPath: Icons.historyIcon,
                        label: locale.map("external-files-vscode.recentlyUsedExternalFiles"),
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        contextValue: `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`,
                    }
                ]
            case `${publisher}.${applicationKey}.pinnedExternalFilesRoot`:
                const pinnedExternalDocuments = PinnedExternalFiles.get();
                return 0 < pinnedExternalDocuments.length ?
                    pinnedExternalDocuments.map
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
                            },
                            contextValue: `${publisher}.${applicationKey}.pinnedExternalFile`,
                        })
                    ):
                    [{
                        label: locale.map("noExternalFiles.message"),
                        contextValue: `${publisher}.${applicationKey}.noFiles`,
                    }];
            case `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`:
                const recentlyUsedExternalDocuments = RecentlyUsedExternalFiles.get();
                return 0 < recentlyUsedExternalDocuments.length ?
                    recentlyUsedExternalDocuments.map
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
                            },
                            contextValue: `${publisher}.${applicationKey}.recentlyUsedExternalFile`,
                        })
                    ):
                    [{
                        label: locale.map("noExternalFiles.message"),
                        contextValue: `${publisher}.${applicationKey}.noFiles`,
                    }];
            default:
                return [];
            }
        }
        update = () => this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }
    let externalFilesProvider = new ExternalFilesProvider();
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
    export const addPinnedFile = async (node: any): Promise<void> =>
    {
        await PinnedExternalFiles.add(node.resourceUri);
        await RecentlyUsedExternalFiles.remove(node.resourceUri);
        externalFilesProvider.update();
    };
    export const removePinnedFile = async (node: any): Promise<void> =>
    {
        await PinnedExternalFiles.remove(node.resourceUri);
        await RecentlyUsedExternalFiles.add(node.resourceUri);
        externalFilesProvider.update();
    };
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
        Icons.initialize(context);
        const showCommandKey = `${applicationKey}.show`;
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(showCommandKey, show),
            vscode.commands.registerCommand(`${applicationKey}.addPinnedFile`, addPinnedFile),
            vscode.commands.registerCommand(`${applicationKey}.removePinnedFile`, removePinnedFile),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.showView`, showView),
            vscode.commands.registerCommand(`${applicationKey}.hideView`, hideView),
            //  TreeDataProovider の登録
            vscode.window.createTreeView(applicationKey, { treeDataProvider: externalFilesProvider }),
            //vscode.window.registerTreeDataProvider(applicationKey, externalFilesProvider),
            //  イベントリスナーの登録
            vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
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
        //RecentlyUsedExternalFiles.clear();
        updateViewOnExplorer();
        externalFilesProvider.update();
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    };
    const onDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined): void =>
    {
        let isPinnedExternalFile = false;
        let isRecentlyUsedExternalFile = false;
        if (editor && isRegularTextEditor(editor))
        {
            isPinnedExternalFile = PinnedExternalFiles.isPinned(editor.document.uri);
            isRecentlyUsedExternalFile = ! isPinnedExternalFile && isExternalFiles(editor.document);
            updateExternalDocuments(editor.document);
        }
        vscode.commands.executeCommand
        (
            "setContext",
            `${publisher}.${applicationKey}.isPinnedExternalFile`,
            isPinnedExternalFile
        );
        vscode.commands.executeCommand
        (
            "setContext",
            `${publisher}.${applicationKey}.isRecentlyUsedExternalFile`,
            isRecentlyUsedExternalFile
        );
    };
    const updateExternalDocuments = async (document: vscode.TextDocument) =>
    {
        if (isExternalFiles(document) && ! PinnedExternalFiles.isPinned(document.uri))
        {
            await RecentlyUsedExternalFiles.add(document.uri);
            externalFilesProvider.update();
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
        RecentlyUsedExternalFiles.get().map
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
        const externalDocuments = RecentlyUsedExternalFiles.get();
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
