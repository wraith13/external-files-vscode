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
    export const isFolderOrFile = async (uri: vscode.Uri): Promise<"folder" | "file" | undefined> =>
    {
        try
        {
            const stat = await vscode.workspace.fs.stat(uri);
            switch(true)
            {
            case 0 < (stat.type & vscode.FileType.Directory):
                return "folder";
            case 0 < (stat.type & vscode.FileType.File):
                return "file";
            default:
                return undefined;
            }
        }
        catch
        {
            return undefined;
        }
    };
    export const isFile = async (uri: vscode.Uri): Promise<boolean> =>
        "file" === await isFolderOrFile(uri);
    export const isFolder = async (uri: vscode.Uri): Promise<boolean> =>
        "folder" === await isFolderOrFile(uri);
    export const getSubFolders = async (uri: vscode.Uri): Promise<vscode.Uri[]> =>
    {
        const stat = await vscode.workspace.fs.stat(uri);
        if (0 <= (stat.type & vscode.FileType.Directory))
        {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries
                .filter(i => 0 < (i[1] & vscode.FileType.Directory))
                .map(i => vscode.Uri.joinPath(uri, i[0]));
        }
        return [];
    };
    export const getFiles = async (uri: vscode.Uri): Promise<vscode.Uri[]> =>
    {
        const stat = await vscode.workspace.fs.stat(uri);
        if (0 <= (stat.type & vscode.FileType.Directory))
        {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries
                .filter(i => 0 < (i[1] & vscode.FileType.File))
                .map(i => vscode.Uri.joinPath(uri, i[0]));
        }
        return [];
    };
    const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    const isExternalFiles = (uri: vscode.Uri): boolean =>
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => uri.path.startsWith(i.uri.path)).length;
    const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
    namespace PinnedExternalFolders
    {
        const key = `${publisher}.${applicationKey}.pinnedExternalFolders`;
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
        export let folderIcon: vscode.IconPath;
        export let pinIcon: vscode.IconPath;
        export let historyIcon: vscode.IconPath;
        export const initialize = (context: vscode.ExtensionContext): void =>
        {
            folderIcon = new vscode.ThemeIcon("folder");
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
        async getChildren(element?: vscode.TreeItem | undefined): Promise<vscode.TreeItem[]>
        {
            switch(element?.contextValue)
            {
            case undefined:
                return [
                    {
                        iconPath: Icons.folderIcon,
                        label: locale.map("external-files-vscode.externalFolders"),
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        contextValue: `${publisher}.${applicationKey}.pinnedExternalFoldersRoot`,
                    },
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
                ];
            case `${publisher}.${applicationKey}.pinnedExternalFoldersRoot`:
                const pinnedExternalFolders = PinnedExternalFolders.get();
                return 0 < pinnedExternalFolders.length ?
                    pinnedExternalFolders.map
                    (
                        i =>
                        ({
                            iconPath: Icons.folderIcon,
                            label: stripDirectory(i.fsPath),
                            resourceUri: i,
                            description: stripFileName(i.fsPath),
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            contextValue: `${publisher}.${applicationKey}.pinnedExternalFolder`,
                        })
                    ):
                    [{
                        label: locale.map("noExternalFolders.message"),
                        contextValue: `${publisher}.${applicationKey}.noFiles`,
                    }];
            case `${publisher}.${applicationKey}.pinnedExternalFolder`:
            case `${publisher}.${applicationKey}.externalFolder`:
                if (element.resourceUri)
                {
                    const subFolders = await getSubFolders(element.resourceUri);
                    const files = await getFiles(element.resourceUri);
                    return [
                        ...subFolders.map
                        (
                            i =>
                            ({
                                iconPath: Icons.folderIcon,
                                label: stripDirectory(i.fsPath),
                                resourceUri: i,
                                //description: stripFileName(i.fsPath),
                                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                                contextValue: `${publisher}.${applicationKey}.externalFolder`,
                            })
                        ),
                        ...files.map
                        (
                            i =>
                            ({
                                iconPath: vscode.ThemeIcon.File,
                                label: stripDirectory(i.fsPath),
                                resourceUri: i,
                                //description: stripFileName(i.fsPath),
                                command:
                                {
                                    title: "show",
                                    command: "vscode.open",
                                    arguments:[i]
                                },
                                contextValue: `${publisher}.${applicationKey}.externalFile`,
                            })
                        )
                    ];
                }
                return [];
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
    let treeDataProvider = new ExternalFilesProvider();
    class DragAndDropController implements vscode.TreeDragAndDropController<vscode.TreeItem>
    {
        public readonly dropMimeTypes = ["text/uri-list"];
        public readonly dragMimeTypes = ["text/uri-list"];
        public handleDrag(source: vscode.TreeItem[], dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): void
        {
            source.map(i => i.resourceUri).filter(i => undefined !== i).forEach
            (
                i => dataTransfer.set
                (
                    "text/uri-list",
                    new vscode.DataTransferItem(i.toString())
                )
            );
        }
        public async handleDrop(target: vscode.TreeItem, dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void>
        {
            const uris = dataTransfer.get("text/uri-list");
            if (uris)
            {
                const uriList = uris.value.split("\n")
                    .map((i: string) => i.trim())
                    .filter((i: string) => 0 < i.length)
                    .map((i: string) => vscode.Uri.parse(i));
                switch(target.contextValue)
                {
                case `${publisher}.${applicationKey}.pinnedExternalFoldersRoot`:
                case `${publisher}.${applicationKey}.externalFolder`:
                case `${publisher}.${applicationKey}.externalFile`:
                case `${publisher}.${applicationKey}.pinnedExternalFilesRoot`:
                case `${publisher}.${applicationKey}.pinnedExternalFolder`:
                case `${publisher}.${applicationKey}.pinnedExternalFile`:
                    await Promise.all
                    (
                        uriList.map
                        (
                            async (uri: vscode.Uri) =>
                            {
                                if (isExternalFiles(uri))
                                {
                                    switch(await isFolderOrFile(uri))
                                    {
                                    case "folder":
                                        if ( ! PinnedExternalFolders.isPinned(uri))
                                        {
                                            await PinnedExternalFolders.add(uri);
                                        }
                                        break;
                                    case "file":
                                        if ( ! PinnedExternalFiles.isPinned(uri))
                                        {
                                            await PinnedExternalFiles.add(uri);
                                            await RecentlyUsedExternalFiles.remove(uri);
                                        }
                                        break;
                                    default:
                                        break;
                                    }
                                }
                            }
                        )
                    );
                    break;
                case `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`:
                case `${publisher}.${applicationKey}.recentlyUsedExternalFile`:
                    await Promise.all
                    (
                        uriList.map
                        (
                            async (uri: vscode.Uri) =>
                            {
                                if (PinnedExternalFiles.isPinned(uri))
                                {
                                    await PinnedExternalFolders.remove(uri);
                                }
                                if (isExternalFiles(uri))
                                {
                                    await RecentlyUsedExternalFiles.add(uri);
                                }
                            }
                        )
                    );
                    break;
                default:
                    break;
                }
                treeDataProvider.update();
            }
        }
    }
    const dragAndDropController = new DragAndDropController();
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
    export const addExternalFolder = async (): Promise<void> =>
    {
        const folders = await vscode.window.showOpenDialog
        (
            {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: locale.map("external-files-vscode.addExternalFolder.title"),
                title: locale.map("external-files-vscode.externalFolders"),
            }
        );
        if (folders)
        {
            await Promise.all
            (
                folders.map
                (
                    async (resourceUri: vscode.Uri) =>
                        await PinnedExternalFolders.add(resourceUri)
                )
            );
            treeDataProvider.update();
        }
    };
    export const removeExternalFolder = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        await PinnedExternalFolders.remove(resourceUri);
        treeDataProvider.update();
    };
    export const addPinnedFile = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        if (undefined === resourceUri)
        {
            const files = await vscode.window.showOpenDialog
            (
                {
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    openLabel: locale.map("external-files-vscode.addPinnedFile.title"),
                    title: locale.map("external-files-vscode.pinnedExternalFiles"),
                }
            );
            if (files)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                        {
                            if (isExternalFiles(resourceUri))
                            {
                                await PinnedExternalFiles.add(resourceUri);
                                await RecentlyUsedExternalFiles.remove(resourceUri);
                            }
                        }
                    )
                );
                treeDataProvider.update();
            }

        }
        else
        {
            if (isExternalFiles(resourceUri))
            {
                await PinnedExternalFiles.add(resourceUri);
                await RecentlyUsedExternalFiles.remove(resourceUri);
                treeDataProvider.update();
            }
        }
    };
    export const removePinnedFile = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        await PinnedExternalFiles.remove(resourceUri);
        await RecentlyUsedExternalFiles.add(resourceUri);
        treeDataProvider.update();
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
            vscode.commands.registerCommand(`${applicationKey}.addExternalFolder`, addExternalFolder),
            vscode.commands.registerCommand(`${applicationKey}.removeExternalFolder`, node => removeExternalFolder(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.addPinnedFile`, node => addPinnedFile(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.removePinnedFile`, node => removePinnedFile(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.showView`, showView),
            vscode.commands.registerCommand(`${applicationKey}.hideView`, hideView),
            //  TreeDataProovider の登録
            vscode.window.createTreeView(applicationKey, { treeDataProvider, dragAndDropController }),
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
        treeDataProvider.update();
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    };
    const onDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined): void =>
    {
        let isPinnedExternalFile = false;
        let isRecentlyUsedExternalFile = false;
        if (editor && isRegularTextEditor(editor))
        {
            isPinnedExternalFile = PinnedExternalFiles.isPinned(editor.document.uri);
            isRecentlyUsedExternalFile = ! isPinnedExternalFile && isExternalDocuments(editor.document);
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
        if (isExternalDocuments(document) && ! PinnedExternalFiles.isPinned(document.uri))
        {
            await RecentlyUsedExternalFiles.add(document.uri);
            treeDataProvider.update();
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
