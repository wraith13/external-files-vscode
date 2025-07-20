'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import { locale } from "./locale";
import { File } from "./file";
import { Bookmark } from "./bookmark";
import packageJson from "../package.json";
export const undefinedable = <ValueType, ResultType>(target: (value: ValueType) => ResultType) =>
    (value: ValueType | undefined): ResultType | undefined =>
        undefined === value ? undefined : target(value);
export namespace ExternalFiles
{
    const publisher = packageJson.publisher;
    const applicationKey = packageJson.name;
    export namespace Config
    {
        const root = vscel.config.makeRoot(packageJson);
        export const maxRecentlyFiles = root.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
    }
    export const makeSureEndWithSlash = (path: string): string =>
        path.endsWith("/") ? path : path + "/";
    const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    const isExternalFiles = (uri: vscode.Uri): boolean =>
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => uri.path.startsWith(i.uri.path)).length;
    const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
    export namespace GlobalBookmark
    {
        const stateKey = `${publisher}.${applicationKey}.globalBookmark`;
        const uriPrefix = `${publisher}.${applicationKey}://globalBookmark/`;
        export const get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(extensionContext.globalState.get<Bookmark.JsonType>(stateKey, {}));
        export const set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            extensionContext.globalState.update(stateKey, Bookmark.liveToJson(bookmark));
        export const addKey = (key: string): Thenable<void> =>
            set(Bookmark.addKey(get(), key));
        export const addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFolder(get(), key, document));
        export const removeFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFolder(get(), key, document));
        export const addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFile(get(), key, document));
        export const removeFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFile(get(), key, document));
        export const getUri = (key: string): vscode.Uri =>
            vscode.Uri.parse(`${uriPrefix}${encodeURIComponent(key)}`);
        export const getKeyFromUri = (uri: vscode.Uri): string | undefined =>
            uri.path.startsWith(uriPrefix) ?
                decodeURIComponent(uri.path.substring(uriPrefix.length)):
                undefined;
    }
    export namespace WorkspaceBookmark
    {
        const stateKey = `${publisher}.${applicationKey}.workspaceBookmark`;
        const uriPrefix = `${publisher}.${applicationKey}://workspaceBookmark/`;
        export const get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(extensionContext.workspaceState.get<Bookmark.JsonType>(stateKey, {}));
        export const set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            extensionContext.workspaceState.update(stateKey, Bookmark.liveToJson(bookmark));
        export const addKey = (key: string): Thenable<void> =>
            set(Bookmark.addKey(get(), key));
        export const addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFolder(get(), key, document));
        export const removeFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFolder(get(), key, document));
        export const addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFile(get(), key, document));
        export const removeFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFile(get(), key, document));
        export const getUri = (key: string): vscode.Uri =>
            vscode.Uri.parse(`${uriPrefix}${encodeURIComponent(key)}`);
        export const getKeyFromUri = (uri: vscode.Uri): string | undefined =>
            uri.path.startsWith(uriPrefix) ?
                decodeURIComponent(uri.path.substring(uriPrefix.length)):
                undefined;
    }
    namespace RecentlyUsedExternalFiles
    {
        const stateKey = `${publisher}.${applicationKey}.recentlyUsedExternalFiles`;
        export type JsonType = string[];
        export type LiveType = vscode.Uri[];
        export type ItemType = vscode.Uri;
        export const clear = (): Thenable<void> =>
            extensionContext.workspaceState.update(stateKey, []);
        export const get = (): LiveType =>
            extensionContext.workspaceState.get<JsonType>(stateKey, [])
            .map(i => vscode.Uri.parse(i));
        export const set = (documents: LiveType): Thenable<void> =>
            extensionContext.workspaceState.update(stateKey, documents.map(i => i.toString()));
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
            vscode.Uri.parse(`${publisher}.${applicationKey}://recentlyUsedExternalFiles`);
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
    interface ExtendedTreeItem extends vscode.TreeItem {
        parentResourceUri?: vscode.Uri;
    }
    class ExternalFilesProvider implements vscode.TreeDataProvider<ExtendedTreeItem>
    {
        private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
        readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
        public globalBookmark: { [key: string]: vscode.TreeItem };
        public workspaceBookmark: { [key: string]: vscode.TreeItem };
        public recentlyUsedExternalFilesRoot: vscode.TreeItem;
        constructor()
        {
            this.recentlyUsedExternalFilesRoot =
            {
                iconPath: Icons.historyIcon,
                label: locale.map("external-files-vscode.recentlyUsedExternalFiles"),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`,
                resourceUri: RecentlyUsedExternalFiles.getUri(),
            };
            this.update(undefined);
        }
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        uriToFolderTreeItem = (uri: vscode.Uri, contextValue: string, description?: string, parentResourceUri?: vscode.Uri): ExtendedTreeItem =>
        ({
            iconPath: vscode.ThemeIcon.Folder,
            label: File.stripDirectory(uri.fsPath),
            resourceUri: uri,
            description,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue,
            parentResourceUri,
        });
        uriToFileTreeItem = (uri: vscode.Uri, contextValue: string, description?: string, parentResourceUri?: vscode.Uri): ExtendedTreeItem =>
        ({
            iconPath: vscode.ThemeIcon.File,
            label: File.stripDirectory(uri.fsPath),
            resourceUri: uri,
            description,
            command:
            {
                title: "show",
                command: "vscode.open",
                arguments:[uri]
            },
            contextValue,
            parentResourceUri,
        });
        async getChildren(element?: vscode.TreeItem | undefined): Promise<ExtendedTreeItem[]>
        {
            switch(element?.contextValue)
            {
            case undefined:
                this.globalBookmark = Object.entries(GlobalBookmark.get()).reduce
                (
                    (acc, [key, _value]) =>
                    ({
                        ...acc,
                        [key]:
                        {
                            iconPath: Icons.pinIcon,
                            label: key,
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            contextValue: `${publisher}.${applicationKey}.globalBookmark`,
                            resourceUri: GlobalBookmark.getUri(key),
                        }
                    }),
                    {}
                );
                this.workspaceBookmark = Object.entries(WorkspaceBookmark.get()).reduce
                (
                    (acc, [key, _value]) =>
                    ({
                        ...acc,
                        [key]:
                        {
                            iconPath: Icons.pinIcon,
                            label: key,
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            contextValue: `${publisher}.${applicationKey}.workspaceBookmark`,
                            resourceUri: WorkspaceBookmark.getUri(key),
                        }
                    }),
                    {}
                );
                return [
                    ...Object.values(this.globalBookmark),
                    ...Object.values(this.workspaceBookmark),
                    this.recentlyUsedExternalFilesRoot
                ];
            case `${publisher}.${applicationKey}.globalBookmark`:
                if ("string" === typeof element.label && this.globalBookmark[element.label])
                {
                    return [
                        ...GlobalBookmark.get()[element.label].folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFolder`,
                                File.stripFileName(i.fsPath),
                                element.resourceUri
                            )
                        ),
                        ...GlobalBookmark.get()[element.label].files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFile`,
                                File.stripFileName(i.fsPath),
                                element.resourceUri
                            )
                        )
                    ];
                }
                return [];
            case `${publisher}.${applicationKey}.workspaceBookmark`:
                if ("string" === typeof element.label && this.globalBookmark[element.label])
                {
                    return [
                        ...WorkspaceBookmark.get()[element.label].folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFolder`,
                                File.stripFileName(i.fsPath),
                                element.resourceUri
                            )
                        ),
                        ...WorkspaceBookmark.get()[element.label].files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFile`,
                                File.stripFileName(i.fsPath),
                                element.resourceUri
                            )
                        )
                    ];
                }
                return [];
            case `${publisher}.${applicationKey}.externalFolder`:
                if (element.resourceUri)
                {
                    try
                    {
                        const subFolders = await File.getSubFolders(element.resourceUri);
                        const files = await File.getFiles(element.resourceUri);
                        return [
                            ...subFolders.map
                            (
                                i => this.uriToFolderTreeItem
                                (
                                    i,
                                    `${publisher}.${applicationKey}.externalFolder`
                                )
                            ),
                            ...files.map
                            (
                                i => this.uriToFileTreeItem
                                (
                                    i,
                                    `${publisher}.${applicationKey}.externalFile`
                                )
                            )
                        ];
                    }
                    catch
                    {
                        return [];
                    }
                }
                return [];
            case `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`:
                const recentlyUsedExternalDocuments = RecentlyUsedExternalFiles.get();
                return 0 < recentlyUsedExternalDocuments.length ?
                    recentlyUsedExternalDocuments.map
                    (
                        i => this.uriToFileTreeItem
                        (
                            i,
                            `${publisher}.${applicationKey}.recentlyUsedExternalFile`,
                            File.stripFileName(i.fsPath),
                            element.resourceUri
                        )
                    ):
                    [{
                        label: locale.map("noExternalFiles.message"),
                        contextValue: `${publisher}.${applicationKey}.noFiles`,
                    }];
            default:
                return [];
            }
        }
        update = (data: vscode.TreeItem | undefined) => this.onDidChangeTreeDataEventEmitter.fire(data);
        updateMatchBookmarkByUri = (bookmark: Bookmark.LiveType, uri: vscode.Uri) =>
        {
            Object.keys(bookmark).forEach
            (
                key =>
                {
                    for(const file of bookmark[key].files)
                    {
                        if (file.toString() === uri.toString())
                        {
                            this.update(this.globalBookmark[key]);
                            return;
                        }
                    }
                    for(const folder of bookmark[key].folders)
                    {
                        if (makeSureEndWithSlash(uri.toString()).startsWith(makeSureEndWithSlash(folder.toString())))
                        {
                            this.update(this.globalBookmark[key]);
                            return;
                        }
                    }
                }
            )
        };
        updateByUri = (uri: vscode.Uri) =>
        {
            this.updateMatchBookmarkByUri(GlobalBookmark.get(), uri);
            this.updateMatchBookmarkByUri(WorkspaceBookmark.get(), uri);
        };
        updateGlobalBookmark = async (key: string): Promise<void> =>
            this.update(this.globalBookmark[key]);
        updateWorkspaceBookmark = async (key: string): Promise<void> =>
            this.update(this.workspaceBookmark[key]);
    }
    let treeDataProvider: ExternalFilesProvider;
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
                case `${publisher}.${applicationKey}.externalFolder`:
                case `${publisher}.${applicationKey}.externalFile`:
                    await Promise.all
                    (
                        uriList.map
                        (
                            async (uri: vscode.Uri) =>
                            {
                                if (isExternalFiles(uri))
                                {
                                    switch(await File.isFolderOrFile(uri))
                                    {
                                    case "folder":
                                        break;
                                    case "file":
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
                treeDataProvider.update(undefined);
            }
        }
    }
    const dragAndDropController = new DragAndDropController();
    export const addBookmark = async (): Promise<void> =>
    {
        const selectedBookmark = await vscode.window.showQuickPick
        (
            [
                {
                    label: locale.map("external-files-vscode.addNewGlobalBookmark.title"),
                    value: "new",
                    scope: "new-global"
                },
                {
                    label: locale.map("external-files-vscode.addNewWorkspaceBookmark.title"),
                    value: "new",
                    scope: "new-workspace"
                }
            ],
            {
                placeHolder: locale.map("selectBookmark.title"),
                canPickMany: false,
                ignoreFocusOut: true,
            }
        );
        if (selectedBookmark)
        {
            switch(selectedBookmark.scope)
            {
            case "new-global":
                {
                    const newKey = undefinedable(Bookmark.regulateKey)
                    (
                        await vscode.window.showInputBox
                        (
                            {
                                placeHolder: locale.map("newBookmark.placeHolder"),
                                prompt: locale.map("external-files-vscode.addNewGlobalBookmark.title"),
                            }
                        )
                    );
                    if (newKey)
                    {
                        await GlobalBookmark.addKey(newKey);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            case "new-workspace":
                {
                    const newKey = undefinedable(Bookmark.regulateKey)
                    (
                        await vscode.window.showInputBox
                        (
                            {
                                placeHolder: locale.map("newBookmark.placeHolder"),
                                prompt: locale.map("external-files-vscode.addNewWorkspaceBookmark.title"),
                            }
                        )
                    );
                    if (newKey)
                    {
                        await WorkspaceBookmark.addKey(newKey);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            default:
                break;
            }
        }
    };
    export const reloadAll = async (): Promise<void> =>
        treeDataProvider.update(undefined);
    export const addExternalFiles = async (bookmarkUri: vscode.Uri): Promise<void> =>
    {
        const files = await vscode.window.showOpenDialog
        (
            {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                openLabel: locale.map("external-files-vscode.addExternalFolder.title"),
                title: locale.map("external-files-vscode.externalFolders"),
            }
        );
        if (files)
        {
            const globalBookmarkKey = GlobalBookmark.getKeyFromUri(bookmarkUri);
            if (globalBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                        {
                            switch(await File.isFolderOrFile(resourceUri))
                            {
                            case "folder":
                                await GlobalBookmark.addFolder(globalBookmarkKey, resourceUri);
                                break;
                            case "file":
                                await GlobalBookmark.addFile(globalBookmarkKey, resourceUri);
                                break;
                            default:
                                break;
                            }
                        }
                    )
                );
            }
            const workspaceBookmarkKey = WorkspaceBookmark.getKeyFromUri(bookmarkUri);
            if (workspaceBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                        {
                            switch(await File.isFolderOrFile(resourceUri))
                            {
                            case "folder":
                                await WorkspaceBookmark.addFolder(workspaceBookmarkKey, resourceUri);
                                break;
                            case "file":
                                await WorkspaceBookmark.addFile(workspaceBookmarkKey, resourceUri);
                                break;
                            default:
                                break;
                            }
                        }
                    )
                );
            }
            treeDataProvider.updateByUri(bookmarkUri);
        }
    };
    export const removeExternalFiles = async (node: any): Promise<void> =>
    {
        const bookmarkUri = node.parentResourceUri;
        if (bookmarkUri instanceof vscode.Uri)
        {
            const resourceUri = node.resourceUri;
            if (resourceUri instanceof vscode.Uri)
            {
                const globalBookmarkKey = GlobalBookmark.getKeyFromUri(bookmarkUri);
                if (globalBookmarkKey)
                {
                    switch(await File.isFolderOrFile(resourceUri))
                    {
                    case "folder":
                        await GlobalBookmark.removeFolder(globalBookmarkKey, resourceUri);
                        break;
                    case "file":
                        await GlobalBookmark.removeFile(globalBookmarkKey, resourceUri);
                        break;
                    default:
                        break;
                    }
                }
                const workspaceBookmarkKey = WorkspaceBookmark.getKeyFromUri(bookmarkUri);
                if (workspaceBookmarkKey)
                {
                    switch(await File.isFolderOrFile(resourceUri))
                    {
                    case "folder":
                        await WorkspaceBookmark.removeFolder(workspaceBookmarkKey, resourceUri);
                        break;
                    case "file":
                        await WorkspaceBookmark.removeFile(workspaceBookmarkKey, resourceUri);
                        break;
                    default:
                        break;
                    }
                }
                treeDataProvider.updateByUri(bookmarkUri);
            }
        }
    };
    export const revealInTerminal = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        if (resourceUri)
        {
            await vscode.commands.executeCommand
            (
                "workbench.action.terminal.newWithCwd",
                {
                    cwd: resourceUri.fsPath
                }
            );
        }
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
    export const newFolder = async (node: any): Promise<void> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const newFolderName = await vscode.window.showInputBox
            (
                {
                    placeHolder: locale.map("external-files-vscode.newFolder.title"),
                    prompt: locale.map("external-files-vscode.newFolder.title"),
                }
            );
            if (newFolderName)
            {
                const newFolderUri = vscode.Uri.joinPath(node.resourceUri, newFolderName);
                try
                {
                    await vscode.workspace.fs.createDirectory(newFolderUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                treeDataProvider.updateByUri(node.resourceUri);
            }
        }
    };
    export const newFile = async (node: any): Promise<void> =>
    {
        if (await File.newFile(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const renameFolder = async (node: any): Promise<void> =>
    {
        if (await File.renameFolder(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const removeFolder = async (node: any): Promise<void> =>
    {
        if (await File.removeFolder(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const renameFile = async (node: any): Promise<void> =>
    {
        if (await File.renameFile(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const removeFile = async (node: any): Promise<void> =>
    {
        if (await File.removeFile(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const registerToBookmark = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        const globalBookmarkKeys = Object.keys(GlobalBookmark.get());
        const workspaceBookmarkKeys = Object.keys(WorkspaceBookmark.get());
        const selectedBookmark = await vscode.window.showQuickPick
        (
            [
                ...globalBookmarkKeys.map(i => ({ label: i, value: i, scope: "global" })),
                ...workspaceBookmarkKeys.map(i => ({ label: i, value: i, scope: "workspace" })),
                {
                    label: locale.map("external-files-vscode.addNewGlobalBookmark.title"),
                    value: "new",
                    scope: "new-global"
                },
                {
                    label: locale.map("external-files-vscode.addNewWorkspaceBookmark.title"),
                    value: "new",
                    scope: "new-workspace"
                }
            ],
            {
                placeHolder: locale.map("selectBookmark.title"),
                canPickMany: false,
                ignoreFocusOut: true,
            }
        );
        if (selectedBookmark)
        {
            switch(selectedBookmark.scope)
            {
            case "global":
                await GlobalBookmark.addFolder(selectedBookmark.value, resourceUri);
                treeDataProvider.updateGlobalBookmark(selectedBookmark.value);
                break;
            case "workspace":
                await WorkspaceBookmark.addFolder(selectedBookmark.value, resourceUri);
                treeDataProvider.updateWorkspaceBookmark(selectedBookmark.value);
                break;
            case "new-global":
                {
                    const newKey = undefinedable(Bookmark.regulateKey)
                    (
                        await vscode.window.showInputBox
                        (
                            {
                                placeHolder: locale.map("newBookmark.placeHolder"),
                                prompt: locale.map("external-files-vscode.addNewGlobalBookmark.title"),
                            }
                        )
                    );
                    if (newKey)
                    {
                        await GlobalBookmark.addFolder(newKey, resourceUri);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            case "new-workspace":
                {
                    const newKey = undefinedable(Bookmark.regulateKey)
                    (
                        await vscode.window.showInputBox
                        (
                            {
                                placeHolder: locale.map("newBookmark.placeHolder"),
                                prompt: locale.map("external-files-vscode.addNewWorkspaceBookmark.title"),
                            }
                        )
                    );
                    if (newKey)
                    {
                        await WorkspaceBookmark.addFolder(newKey, resourceUri);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            default:
                break;
            }
        }
    };
    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        Icons.initialize(context);
        treeDataProvider = new ExternalFilesProvider();
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(`${applicationKey}.addBookmark`, addBookmark),
            vscode.commands.registerCommand(`${applicationKey}.reloadAll`, reloadAll),
            vscode.commands.registerCommand(`${applicationKey}.addExternalFiles`, addExternalFiles),
            vscode.commands.registerCommand(`${applicationKey}.removeExternalFile`, removeExternalFiles),
            vscode.commands.registerCommand(`${applicationKey}.registerToBookmark`, registerToBookmark),
            vscode.commands.registerCommand(`${applicationKey}.newFile`, newFile),
            vscode.commands.registerCommand(`${applicationKey}.newFolder`, newFolder),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${applicationKey}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${applicationKey}.revealInTerminal`, node => revealInTerminal(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${applicationKey}.renameFolder`, renameFolder),
            vscode.commands.registerCommand(`${applicationKey}.removeFolder`, removeFolder),
            vscode.commands.registerCommand(`${applicationKey}.renameFile`, renameFile),
            vscode.commands.registerCommand(`${applicationKey}.removeFile`, removeFile),
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
                        RecentlyUsedExternalFiles.regulate();
                        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
                    }
                }
            ),
            vscode.workspace.onDidChangeWorkspaceFolders(_ => treeDataProvider.update(undefined)),
        );
        //RecentlyUsedExternalFiles.clear();
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
    };
    const onDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined): void =>
    {
        let isRecentlyUsedExternalFile = false;
        if (editor && isRegularTextEditor(editor))
        {
            isRecentlyUsedExternalFile = isExternalDocuments(editor.document);
            updateExternalDocuments(editor.document);
        }
        vscode.commands.executeCommand
        (
            "setContext",
            `${publisher}.${applicationKey}.isRecentlyUsedExternalFile`,
            isRecentlyUsedExternalFile
        );
    };
    const updateExternalDocuments = async (document: vscode.TextDocument) =>
    {
        if (isExternalDocuments(document))
        {
            await RecentlyUsedExternalFiles.add(document.uri);
            treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
        }
    };
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
