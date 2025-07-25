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
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => makeSureEndWithSlash(uri.path).startsWith(makeSureEndWithSlash(i.uri.path))).length;
    const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
    export namespace GlobalBookmark
    {
        export const stateKey = `${publisher}.${applicationKey}.globalBookmark`;
        export const uriPrefix = `${publisher}.${applicationKey}://global-bookmark/`;
        export const instance = new Bookmark.Instance
        (
            uriPrefix,
            () => extensionContext.globalState.get<Bookmark.JsonType>(stateKey, {}),
            (bookmark: Bookmark.JsonType) => extensionContext.globalState.update(stateKey, bookmark)
        );
    }
    export namespace WorkspaceBookmark
    {
        export const stateKey = `${publisher}.${applicationKey}.workspaceBookmark`;
        export const uriPrefix = `${publisher}.${applicationKey}://workspace-bookmark/`;
        export const instance = new Bookmark.Instance
        (
            uriPrefix,
            () => extensionContext.workspaceState.get<Bookmark.JsonType>(stateKey, {}),
            (bookmark: Bookmark.JsonType) => extensionContext.workspaceState.update(stateKey, bookmark)
        );
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
                contextValue: `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`,
                resourceUri: RecentlyUsedExternalFiles.getUri(),
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
                    contextValue: `${publisher}.${applicationKey}.noFiles`,
                }];
        async getChildren(parent?: vscode.TreeItem | undefined): Promise<ExtendedTreeItem[]>
        {
            switch(parent?.contextValue)
            {
            case undefined:
                this.globalBookmark = Object.entries(GlobalBookmark.instance.get()).reduce
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
                            contextValue: `${publisher}.${applicationKey}.globalBookmark`,
                            resourceUri: GlobalBookmark.instance.getUri(key),
                        }
                    }),
                    {}
                );
                this.workspaceBookmark = Object.entries(WorkspaceBookmark.instance.get()).reduce
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
                            contextValue: `${publisher}.${applicationKey}.workspaceBookmark`,
                            resourceUri: WorkspaceBookmark.instance.getUri(key),
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
                if ("string" === typeof parent.label && this.globalBookmark[parent.label])
                {
                    const entries = await GlobalBookmark.instance.getEntries(parent.label);
                    errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                    errorDecorationProvider.addErrorUris(entries.unknowns);
                    return this.orEmptyMessage
                    ([
                        ...entries.folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFolder`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFile`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.unknowns.map
                        (
                            i => this.uriToUnknownTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalUnknown`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        )
                    ]);
                }
                return [];
            case `${publisher}.${applicationKey}.workspaceBookmark`:
                if ("string" === typeof parent.label && this.workspaceBookmark[parent.label])
                {
                    const entries = await WorkspaceBookmark.instance.getEntries(parent.label);
                    errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                    errorDecorationProvider.addErrorUris(entries.unknowns);
                    return this.orEmptyMessage
                    ([
                        ...entries.folders.map
                        (
                            i => this.uriToFolderTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFolder`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.files.map
                        (
                            i => this.uriToFileTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalFile`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        ),
                        ...entries.unknowns.map
                        (
                            i => this.uriToUnknownTreeItem
                            (
                                i,
                                `${publisher}.${applicationKey}.rootExternalUnknown`,
                                File.stripFileName(i.fsPath),
                                parent
                            )
                        )
                    ]);
                }
                return [];
            case `${publisher}.${applicationKey}.rootExternalFolder`:
            case `${publisher}.${applicationKey}.externalFolder`:
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
                                        `${publisher}.${applicationKey}.externalFolder`,
                                        // File.stripFileName(i.fsPath),
                                        // element.resourceUri
                                    )
                                ),
                                ...filesAndFolders.files.map
                                (
                                    i => this.uriToFileTreeItem
                                    (
                                        i,
                                        `${publisher}.${applicationKey}.externalFile`,
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
            case `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`:
                const recentlyUsedExternalDocuments = RecentlyUsedExternalFiles.get();
                return this.orEmptyMessage
                (
                    recentlyUsedExternalDocuments.map
                    (
                        i => this.uriToFileTreeItem
                        (
                            i,
                            `${publisher}.${applicationKey}.recentlyUsedExternalFile`,
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
            this.updateMatchBookmarkByUri(this.globalBookmark, GlobalBookmark.instance.get(), uri);
            this.updateMatchBookmarkByUri(this.workspaceBookmark, WorkspaceBookmark.instance.get(), uri);
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
                case `${publisher}.${applicationKey}.globalBookmark`:
                    const globalBookmarkKey = undefinedable(GlobalBookmark.instance.getKeyFromUri)(target.resourceUri);
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
                                        await GlobalBookmark.instance.addEntry(globalBookmarkKey, uri);
                                    }
                                }
                            )
                        );
                    }
                    break;
                case `${publisher}.${applicationKey}.workspaceBookmark`:
                    const workspaceBookmarkKey = undefinedable(WorkspaceBookmark.instance.getKeyFromUri)(target.resourceUri);
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
                                        await WorkspaceBookmark.instance.addEntry(workspaceBookmarkKey, uri);
                                    }
                                }
                            )
                        );
                    }
                    break;
                case `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`:
                case `${publisher}.${applicationKey}.recentlyUsedExternalFile`:
                    await Promise.all
                    (
                        uriList.map
                        (
                            async (uri: vscode.Uri) =>
                            {
                                if (isExternalFiles(uri) && await File.isFile(uri))
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
                        await GlobalBookmark.instance.addKey(newKey);
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
                        await WorkspaceBookmark.instance.addKey(newKey);
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
            const globalBookmarkKey = GlobalBookmark.instance.getKeyFromUri(resourceUri);
            if (globalBookmarkKey)
            {
                await GlobalBookmark.instance.removeKey(globalBookmarkKey);
            }
            const workspaceBookmarkKey = WorkspaceBookmark.instance.getKeyFromUri(resourceUri);
            if (workspaceBookmarkKey)
            {
                await WorkspaceBookmark.instance.removeKey(workspaceBookmarkKey);
            }
            treeDataProvider.update(undefined);
        }
    };
    export const clearHistory = async (): Promise<void> =>
    {
        await RecentlyUsedExternalFiles.clear();
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
            const globalBookmarkKey = GlobalBookmark.instance.getKeyFromUri(bookmarkUri);
            if (globalBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                            await GlobalBookmark.instance.addEntry(globalBookmarkKey, resourceUri)
                    )
                );
            }
            const workspaceBookmarkKey = WorkspaceBookmark.instance.getKeyFromUri(bookmarkUri);
            if (workspaceBookmarkKey)
            {
                await Promise.all
                (
                    files.map
                    (
                        async (resourceUri: vscode.Uri) =>
                                await WorkspaceBookmark.instance.addEntry(workspaceBookmarkKey, resourceUri)
                    )
                );
            }
            treeDataProvider.update(node);
        }
    };
    export const registerToBookmark = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        const globalBookmarkKeys = Object.keys(GlobalBookmark.instance.get());
        const workspaceBookmarkKeys = Object.keys(WorkspaceBookmark.instance.get());
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
                await GlobalBookmark.instance.addEntry(selectedBookmark.value, resourceUri);
                treeDataProvider.updateGlobalBookmark(selectedBookmark.value);
                break;
            case "workspace":
                await WorkspaceBookmark.instance.addEntry(selectedBookmark.value, resourceUri);
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
                        await GlobalBookmark.instance.addEntry(newKey, resourceUri);
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
                        await WorkspaceBookmark.instance.addEntry(newKey, resourceUri);
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
        const folderPath = await File.getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const newFolderName = undefinedable(File.regulateName)
            (
                await vscode.window.showInputBox
                (
                    {
                        placeHolder: locale.map("external-files-vscode.newFolder.title"),
                        prompt: locale.map("external-files-vscode.newFolder.title"),
                    }
                )
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
                const globalBookmarkKey = GlobalBookmark.instance.getKeyFromUri(bookmarkUri);
                if (globalBookmarkKey)
                {
                    await GlobalBookmark.instance.removeEntry(globalBookmarkKey, resourceUri);
                }
                const workspaceBookmarkKey = WorkspaceBookmark.instance.getKeyFromUri(bookmarkUri);
                if (workspaceBookmarkKey)
                {
                    await WorkspaceBookmark.instance.removeEntry(workspaceBookmarkKey, resourceUri);
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
            vscode.commands.registerCommand(`${applicationKey}.newBookmark`, newBookmark),
            vscode.commands.registerCommand(`${applicationKey}.reloadAll`, reloadAll),
            vscode.commands.registerCommand(`${applicationKey}.removeBookmark`, removeBookmark),
            vscode.commands.registerCommand(`${applicationKey}.clearHistory`, clearHistory),
            vscode.commands.registerCommand(`${applicationKey}.addExternalFiles`, addExternalFiles),
            vscode.commands.registerCommand(`${applicationKey}.registerToBookmark`, node => registerToBookmark(node.resourceUri)),
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
            vscode.commands.registerCommand(`${applicationKey}.reload`, reload),
            vscode.commands.registerCommand(`${applicationKey}.removeExternalFile`, removeExternalFiles),
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
                        RecentlyUsedExternalFiles.regulate();
                        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
                    }
                }
            ),
            vscode.workspace.onDidChangeWorkspaceFolders(_ => treeDataProvider.update(undefined)),
        );
        // GlobalBookmark.instance.clear();
        // WorkspaceBookmark.instance.clear();
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
