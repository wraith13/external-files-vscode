'use strict';
import * as vscode from 'vscode';
import { undefinedable } from "./undefinedable";
import { regulateName } from "./regulate-name";
import { Application } from './application';
import { locale } from "./locale";
import { File } from "./file";
import { Bookmark } from "./bookmark";
import { Recentlies } from "./recentlies";
import packageJson from "../package.json";
export namespace ExternalFiles
{
    export const makeSureEndWithSlash = (path: string): string =>
        path.endsWith("/") ? path : path + "/";
    const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    const isExternalFiles = (uri: vscode.Uri): boolean =>
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => makeSureEndWithSlash(uri.path).startsWith(makeSureEndWithSlash(i.uri.path))).length;
    const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
    export const onDidChangeUri = (oldUri: vscode.Uri, newUri: vscode.Uri | "removed"): boolean =>
        [
            Bookmark.global.onDidChangeUri(oldUri, newUri),
            Bookmark.workspace.onDidChangeUri(oldUri, newUri),
            Recentlies.onDidChangeUri(oldUri, newUri),
        ]
        .some(i => i);
    namespace Icons
    {
        export let folder: vscode.IconPath;
        export let file: vscode.IconPath;
        export let error: vscode.IconPath;
        export let bookmark: vscode.IconPath;
        export let pin: vscode.IconPath;
        export let history: vscode.IconPath;
        export const initialize = (context: vscode.ExtensionContext): void =>
        {
            folder = vscode.ThemeIcon.Folder;
            file = vscode.ThemeIcon.File;
            error = new vscode.ThemeIcon("error");
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
    let treeDataProvider: ExternalFilesProvider;
    class ErrorDecorationProvider implements vscode.FileDecorationProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
        readonly onDidChangeFileDecorations = this._onDidChange.event;
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
            this._onDidChange.fire(uris.map(i => vscode.Uri.parse(i)));
        }
        addErrorUri(uri: vscode.Uri): void
        {
            if ( ! this.errorUris.includes(uri.toString()))
            {
                this.errorUris.push(uri.toString());
                this._onDidChange.fire(uri);
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
                this._onDidChange.fire(uri);
            }
        }
        removeErrorUris(uris: vscode.Uri[]): void
        {
            uris.forEach(uri => this.removeErrorUri(uri));
        }
    }
    interface ExtendedTreeItem extends vscode.TreeItem
    {
        parent?: vscode.TreeItem;
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
                iconPath: Icons.history,
                label: locale.map("external-files-vscode.recentlyUsedExternalFiles"),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: Application.makeKey("recentlyUsedExternalFilesRoot"),
                resourceUri: Recentlies.getUri(),
            };
        }
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        uriToFolderTreeItem = (resourceUri: vscode.Uri, contextValue: string, description?: string, parent?: vscode.TreeItem): ExtendedTreeItem =>
        ({
            iconPath: Icons.folder,
            label: File.stripDirectory(resourceUri.fsPath),
            resourceUri,
            description,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue,
            parent,
        });
        uriToFileTreeItem = (resourceUri: vscode.Uri, contextValue: string, description?: string, parent?: vscode.TreeItem): ExtendedTreeItem =>
        ({
            iconPath: Icons.file,
            label: File.stripDirectory(resourceUri.fsPath),
            resourceUri,
            description,
            command:
            {
                title: "show",
                command: "vscode.open",
                arguments:[resourceUri]
            },
            contextValue,
            parent,
        });
        uriToUnknownTreeItem = (resourceUri: vscode.Uri, contextValue: string, description?: string, parent?: vscode.TreeItem): ExtendedTreeItem =>
        ({
            iconPath: Icons.error,
            label: File.stripDirectory(resourceUri.fsPath),
            resourceUri,
            description,
            command:
            {
                title: "show",
                command: "vscode.open",
                arguments:[resourceUri]
            },
            contextValue,
            parent,
        });
        orEmptyMessage = (source: ExtendedTreeItem[]): ExtendedTreeItem[] =>
            0 < source.length ?
                source:
                [{
                    label: locale.map("noExternalFiles.message"),
                    contextValue: Application.makeKey("noFiles"),
                }];
        async getChildren(parent?: vscode.TreeItem | undefined): Promise<ExtendedTreeItem[]>
        {
            switch(parent?.contextValue)
            {
            case undefined:
                this.globalBookmark = Object.entries(Bookmark.global.get()).reduce
                (
                    (acc, [key, _value]) =>
                    ({
                        ...acc,
                        [key]:
                        {
                            iconPath: Icons.bookmark,
                            label: key,
                            description: locale.map("scope.global"),
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            contextValue: Application.makeKey("globalBookmark"),
                            resourceUri: Bookmark.global.getUri(key),
                        }
                    }),
                    {}
                );
                this.workspaceBookmark = Object.entries(Bookmark.workspace.get()).reduce
                (
                    (acc, [key, _value]) =>
                    ({
                        ...acc,
                        [key]:
                        {
                            iconPath: Icons.bookmark,
                            label: key,
                            description: locale.map("scope.workspace"),
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            contextValue: Application.makeKey("workspaceBookmark"),
                            resourceUri: Bookmark.workspace.getUri(key),
                        }
                    }),
                    {}
                );
                return [
                    ...Object.values(this.globalBookmark),
                    ...Object.values(this.workspaceBookmark),
                    this.recentlyUsedExternalFilesRoot
                ];
            case Application.makeKey("globalBookmark"):
                if ("string" === typeof parent.label && this.globalBookmark[parent.label])
                {
                    const entries = await Bookmark.global.getEntries(parent.label);
                    errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                    errorDecorationProvider.addErrorUris(entries.unknowns);
                    return this.orEmptyMessage
                    ([
                        ...entries.folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalFolder"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalFile"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.unknowns.map
                        (
                            i => this.uriToUnknownTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalUnknown"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        )
                    ]);
                }
                return [];
            case Application.makeKey("workspaceBookmark"):
                if ("string" === typeof parent.label && this.workspaceBookmark[parent.label])
                {
                    const entries = await Bookmark.workspace.getEntries(parent.label);
                    errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                    errorDecorationProvider.addErrorUris(entries.unknowns);
                    return this.orEmptyMessage
                    ([
                        ...entries.folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalFolder"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalFile"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.unknowns.map
                        (
                            i => this.uriToUnknownTreeItem
                            (
                                i,
                                Application.makeKey("rootExternalUnknown"),
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        )
                    ]);
                }
                return [];
            case Application.makeKey("rootExternalFolder"):
            case Application.makeKey("externalFolder"):
                if (parent.resourceUri)
                {
                    try
                    {
                        const filesAndFolders = await File.getFoldersAndFiles(parent.resourceUri);
                        if (filesAndFolders)
                        {
                            return [
                                ...filesAndFolders.folders.map
                                (
                                    i => this.uriToFolderTreeItem
                                    (
                                        i,
                                        Application.makeKey("externalFolder"),
                                        // File.stripFileName(i.fsPath),
                                        // element.resourceUri
                                    )
                                ),
                                ...filesAndFolders.files.map
                                (
                                    i => this.uriToFileTreeItem
                                    (
                                        i,
                                        Application.makeKey("externalFile"),
                                        // File.stripFileName(i.fsPath),
                                        // element.resourceUri
                                    )
                                )
                            ];
                        }
                    }
                    catch
                    {
                        return [];
                    }
                }
                return [];
            case Application.makeKey("recentlyUsedExternalFilesRoot"):
                const recentlyUsedExternalDocuments = Recentlies.get();
                return this.orEmptyMessage
                (
                    recentlyUsedExternalDocuments.map
                    (
                        i => this.uriToFileTreeItem
                        (
                            i,
                            Application.makeKey("recentlyUsedExternalFile"),
                            File.stripFileName(i.fsPath),
                            parent
                        )
                    )
                );
            default:
                return [];
            }
        }
        update = (data: vscode.TreeItem | undefined) =>
        {
            if (undefined === data)
            {
                errorDecorationProvider.clearErrorUris();
            }
            this.onDidChangeTreeDataEventEmitter.fire(data);
        }
        updateMatchBookmarkByUri = (map: { [key: string]: vscode.TreeItem }, bookmark: Bookmark.LiveType, uri: vscode.Uri) =>
        {
            Object.keys(bookmark).forEach
            (
                key =>
                {
                    for(const folder of bookmark[key])
                    {
                        if (makeSureEndWithSlash(uri.toString()).startsWith(makeSureEndWithSlash(folder.toString())))
                        {
                            this.update(map[key]);
                            return;
                        }
                    }
                }
            )
        };
        updateByUri = (uri: vscode.Uri) =>
        {
            this.updateMatchBookmarkByUri(this.globalBookmark, Bookmark.global.get(), uri);
            this.updateMatchBookmarkByUri(this.workspaceBookmark, Bookmark.workspace.get(), uri);
        };
        updateGlobalBookmark = async (key: string): Promise<void> =>
            this.update(this.globalBookmark[key]);
        updateWorkspaceBookmark = async (key: string): Promise<void> =>
            this.update(this.workspaceBookmark[key]);
    }
    let errorDecorationProvider: ErrorDecorationProvider;
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
                case Application.makeKey("globalBookmark"):
                    const globalBookmarkKey = undefinedable(Bookmark.global.getKeyFromUri)(target.resourceUri);
                    if (globalBookmarkKey)
                    {
                        await Promise.all
                        (
                            uriList.map
                            (
                                async (uri: vscode.Uri) =>
                                {
                                    if (isExternalFiles(uri) && undefined !== await File.isFolderOrFile(uri))
                                    {
                                        await Bookmark.global.addEntry(globalBookmarkKey, uri);
                                    }
                                }
                            )
                        );
                    }
                    break;
                case Application.makeKey("workspaceBookmark"):
                    const workspaceBookmarkKey = undefinedable(Bookmark.workspace.getKeyFromUri)(target.resourceUri);
                    if (workspaceBookmarkKey)
                    {
                        await Promise.all
                        (
                            uriList.map
                            (
                                async (uri: vscode.Uri) =>
                                {
                                    if (isExternalFiles(uri) && undefined !== await File.isFolderOrFile(uri))
                                    {
                                        await Bookmark.workspace.addEntry(workspaceBookmarkKey, uri);
                                    }
                                }
                            )
                        );
                    }
                    break;
                case Application.makeKey("recentlyUsedExternalFilesRoot"):
                case Application.makeKey("recentlyUsedExternalFile"):
                    await Promise.all
                    (
                        uriList.map
                        (
                            async (uri: vscode.Uri) =>
                            {
                                if (isExternalFiles(uri) && await File.isFile(uri))
                                {
                                    await Recentlies.add(uri);
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
    export const newBookmark = async (): Promise<void> =>
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
                    const newKey = undefinedable(regulateName)
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
                        await Bookmark.global.addKey(newKey);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            case "new-workspace":
                {
                    const newKey = undefinedable(regulateName)
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
                        await Bookmark.workspace.addKey(newKey);
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
    export const removeBookmark = async (node: any): Promise<void> =>
    {
        const resourceUri = node.resourceUri;
        if (resourceUri instanceof vscode.Uri)
        {
            const globalBookmarkKey = Bookmark.global.getKeyFromUri(resourceUri);
            if (globalBookmarkKey)
            {
                await Bookmark.global.removeKey(globalBookmarkKey);
            }
            const workspaceBookmarkKey = Bookmark.workspace.getKeyFromUri(resourceUri);
            if (workspaceBookmarkKey)
            {
                await Bookmark.workspace.removeKey(workspaceBookmarkKey);
            }
            treeDataProvider.update(undefined);
        }
    };
    export const clearHistory = async (): Promise<void> =>
    {
        await Recentlies.clear();
        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
    };
    export const addExternalFiles = async (node: any): Promise<void> =>
    {
        const files = await vscode.window.showOpenDialog
        (
            {
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: locale.map("external-files-vscode.addExternalFiles.button"),
                title: locale.map("external-files-vscode.externalFolders"),
            }
        );
        if (files)
        {
            const bookmarkUri = node.resourceUri;
            const globalBookmarkKey = Bookmark.global.getKeyFromUri(bookmarkUri);
            if (globalBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                            await Bookmark.global.addEntry(globalBookmarkKey, resourceUri)
                    )
                );
            }
            const workspaceBookmarkKey = Bookmark.workspace.getKeyFromUri(bookmarkUri);
            if (workspaceBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                                await Bookmark.workspace.addEntry(workspaceBookmarkKey, resourceUri)
                    )
                );
            }
            treeDataProvider.update(node);
        }
    };
    export const registerToBookmark = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        const globalBookmarkKeys = Object.keys(Bookmark.global.get());
        const workspaceBookmarkKeys = Object.keys(Bookmark.workspace.get());
        const selectedBookmark = await vscode.window.showQuickPick
        (
            [
                ...globalBookmarkKeys.map
                (
                    i =>
                    ({
                        label: `$(bookmark) ${i}`,
                        description: locale.map("scope.global"),
                        value: i,
                        scope: "global"
                    })
                ),
                ...workspaceBookmarkKeys.map
                (
                    i =>
                    ({
                        label: `$(bookmark) ${i}`,
                        description: locale.map("scope.workspace"),
                        value: i,
                        scope: "workspace"
                    })
                ),
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
                await Bookmark.global.addEntry(selectedBookmark.value, resourceUri);
                treeDataProvider.updateGlobalBookmark(selectedBookmark.value);
                break;
            case "workspace":
                await Bookmark.workspace.addEntry(selectedBookmark.value, resourceUri);
                treeDataProvider.updateWorkspaceBookmark(selectedBookmark.value);
                break;
            case "new-global":
                {
                    const newKey = undefinedable(regulateName)
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
                        await Bookmark.global.addEntry(newKey, resourceUri);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            case "new-workspace":
                {
                    const newKey = undefinedable(regulateName)
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
                        await Bookmark.workspace.addEntry(newKey, resourceUri);
                        treeDataProvider.update(undefined);
                    }
                }
                break;
            default:
                break;
            }
        }
    };
    export const newFolder = async (node: any): Promise<void> =>
    {
        if (await File.newFolder(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const newFile = async (node: any): Promise<void> =>
    {
        if (await File.newFile(node))
        {
            treeDataProvider.updateByUri(node.resourceUri);
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
    export const renameFolder = async (node: any): Promise<void> =>
    {
        const newFolderUri = await File.renameFolder(node);
        if (newFolderUri)
        {
            onDidChangeUri(node.resourceUri, newFolderUri);
            treeDataProvider.update(undefined);
        }
    };
    export const removeFolder = async (node: any): Promise<void> =>
    {
        if (await File.removeFolder(node))
        {
            onDidChangeUri(node.resourceUri, "removed");
            treeDataProvider.update(undefined);
        }
    };
    export const renameFile = async (node: any): Promise<void> =>
    {
        const newFileUri = await File.renameFile(node);
        if (newFileUri)
        {
            onDidChangeUri(node.resourceUri, newFileUri);
            treeDataProvider.update(undefined);
        }
    };
    export const removeFile = async (node: any): Promise<void> =>
    {
        if (await File.removeFile(node))
        {
            onDidChangeUri(node.resourceUri, "removed");
            treeDataProvider.update(undefined);
        }
    };
    export const reload = async (node: any): Promise<void> =>
        treeDataProvider.update(node);
    export const removeExternalFiles = async (node: any): Promise<void> =>
    {
        const bookmarkUri = node.parent?.resourceUri;
        if (bookmarkUri instanceof vscode.Uri)
        {
            const resourceUri = node.resourceUri;
            if (resourceUri instanceof vscode.Uri)
            {
                const globalBookmarkKey = Bookmark.global.getKeyFromUri(bookmarkUri);
                if (globalBookmarkKey)
                {
                    await Bookmark.global.removeEntry(globalBookmarkKey, resourceUri);
                }
                const workspaceBookmarkKey = Bookmark.workspace.getKeyFromUri(bookmarkUri);
                if (workspaceBookmarkKey)
                {
                    await Bookmark.workspace.removeEntry(workspaceBookmarkKey, resourceUri);
                }
                if (errorDecorationProvider.hasErrorUri(resourceUri))
                {
                    errorDecorationProvider.removeErrorUri(resourceUri);
                    treeDataProvider.update(undefined);
                }
                else
                {
                    treeDataProvider.update(node.parent);
                }
            }
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
    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        Icons.initialize(context);
        errorDecorationProvider = new ErrorDecorationProvider();
        treeDataProvider = new ExternalFilesProvider();
        context.subscriptions.push
        (
            vscode.commands.registerCommand(`${Application.key}.newBookmark`, newBookmark),
            vscode.commands.registerCommand(`${Application.key}.reloadAll`, reloadAll),
            vscode.commands.registerCommand(`${Application.key}.removeBookmark`, removeBookmark),
            vscode.commands.registerCommand(`${Application.key}.clearHistory`, clearHistory),
            vscode.commands.registerCommand(`${Application.key}.addExternalFiles`, addExternalFiles),
            vscode.commands.registerCommand(`${Application.key}.registerToBookmark`, node => registerToBookmark(node.resourceUri)),
            vscode.commands.registerCommand(`${Application.key}.newFile`, newFile),
            vscode.commands.registerCommand(`${Application.key}.newFolder`, newFolder),
            vscode.commands.registerCommand(`${Application.key}.revealFileInFinder`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${Application.key}.revealFileInExplorer`, makeCommand("revealFileInOS")),
            vscode.commands.registerCommand(`${Application.key}.showActiveFileInExplorer`, makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
            vscode.commands.registerCommand(`${Application.key}.revealInTerminal`, node => revealInTerminal(node.resourceUri)),
            vscode.commands.registerCommand(`${Application.key}.copyFilePath`, makeCommand("copyFilePath")),
            vscode.commands.registerCommand(`${Application.key}.renameFolder`, renameFolder),
            vscode.commands.registerCommand(`${Application.key}.removeFolder`, removeFolder),
            vscode.commands.registerCommand(`${Application.key}.renameFile`, renameFile),
            vscode.commands.registerCommand(`${Application.key}.removeFile`, removeFile),
            vscode.commands.registerCommand(`${Application.key}.reload`, reload),
            vscode.commands.registerCommand(`${Application.key}.removeExternalFile`, removeExternalFiles),
            vscode.window.registerFileDecorationProvider(errorDecorationProvider),
            vscode.window.createTreeView(packageJson.contributes.views.explorer[0].id, { treeDataProvider, dragAndDropController }),
            vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),
            //vscode.workspace.onDidOpenTextDocument(a => updateExternalDocuments(a)),
            vscode.workspace.onDidChangeConfiguration
            (
                event =>
                {
                    if (event.affectsConfiguration("external-files"))
                    {
                        Recentlies.regulate();
                        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
                    }
                }
            ),
            vscode.workspace.onDidChangeWorkspaceFolders(_ => treeDataProvider.update(undefined)),
        );
        // Bookmark.global.clear();
        // Bookmark.workspace.clear();
        // RecentlyUsedExternalFiles.clear();
        // vscode.window.showErrorMessage
        // (
        //     JSON.stringify
        //     (
        //         {
        //             globalState: extensionContext.globalState.get<Bookmark.JsonType>(`${publisher}.${applicationKey}.globalBookmark`, {}),
        //             workspaceState: extensionContext.workspaceState.get<Bookmark.JsonType>(`${publisher}.${applicationKey}.workspaceBookmark`, {}),
        //             recentlyState: extensionContext.workspaceState.get<RecentlyUsedExternalFiles.JsonType>(`${publisher}.${applicationKey}.recentlyUsedExternalFiles`, []),
        //         },
        //         null,
        //         4
        //     )
        // );
        treeDataProvider.update(undefined);
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
            Application.makeKey("isRecentlyUsedExternalFile"),
            isRecentlyUsedExternalFile
        );
    };
    const updateExternalDocuments = async (document: vscode.TextDocument) =>
    {
        if (isExternalDocuments(document))
        {
            await Recentlies.add(document.uri);
            treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
        }
    };
}
export const activate = (context: vscode.ExtensionContext) : void =>
{
    Application.context = context;
    ExternalFiles.initialize(context);
};
export const deactivate = () : void =>
{
};
