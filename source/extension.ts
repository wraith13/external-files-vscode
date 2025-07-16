'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
export type LocaleKeyType = keyof typeof localeEn;
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
export namespace ExternalFiles
{
    const publisher = packageJson.publisher;
    const applicationKey = packageJson.name;
    export namespace Config
    {
        const root = vscel.config.makeRoot(packageJson);
        export const maxRecentlyFiles = root.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
        export namespace ViewOnExplorer
        {
            export const enabled = root.makeEntry<boolean>("external-files.viewOnExplorer.enabled", "root-workspace");
        }
    }
    export const makeSureEndWithSlash = (path: string): string =>
        path.endsWith("/") ? path : path + "/";
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
    export const getFolderPath = async (resourceUri: vscode.Uri): Promise<string | undefined> =>
    {
        switch(await isFolderOrFile(resourceUri))
        {
        case "folder":
            return resourceUri.fsPath;
        case "file":
            return vscode.Uri.joinPath(resourceUri, "..").fsPath;
        default:
            return undefined;
        }
    };
    const isRegularTextEditor = (editor: vscode.TextEditor): boolean =>
        undefined !== editor.viewColumn && 0 < editor.viewColumn;
    const isExternalFiles = (uri: vscode.Uri): boolean =>
        0 === (vscode.workspace.workspaceFolders ?? []).filter(i => uri.path.startsWith(i.uri.path)).length;
    const isExternalDocuments = (document: vscode.TextDocument): boolean =>
        ! document.isUntitled && isExternalFiles(document.uri);
    namespace Bookmark
    {
        export type JsonType = { [key: string]: { folders: string[]; files: string[]; } };
        export type LiveType = { [key: string]: { folders: vscode.Uri[]; files: vscode.Uri[]; } };
        export const blankEntry = (): LiveType[string] => ({ folders: [], files: [] });
        export const jsonToLive = (json: JsonType): LiveType =>
            Object.entries(json).reduce
            (
                (acc, [key, value]) =>
                ({
                    ...acc,
                    [key]:
                    {
                        folders: value.folders.map(i => vscode.Uri.parse(i)),
                        files: value.files.map(i => vscode.Uri.parse(i)),
                    }
                }),
                {}
            );
        export const liveToJson = (live: LiveType): JsonType =>
            Object.entries(live).reduce
            (
                (acc, [key, value]) =>
                ({
                    ...acc,
                    [key]:
                    {
                        folders: value.folders.map(i => i.toString()),
                        files: value.files.map(i => i.toString()),
                    }
                }),
                {}
            );
        export const addFolder = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
        {
            let entry = bookmark[key] ?? blankEntry();
            let current = entry.folders;
            current = current.filter(i => i.toString() !== document.toString());
            current.unshift(document);
            current.sort();
            entry.folders = current;
            bookmark[key] = entry;
            return bookmark;
        };
        export const removeFolder = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
        {
            let entry = bookmark[key];
            if (entry)
            {
                let current = entry.folders;
                current = current.filter(i => i.toString() !== document.toString());
                current.sort();
                entry.folders = current;
                bookmark[key] = entry;
            }
            return bookmark;
        };
        export const addFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
        {
            let entry = bookmark[key] ?? blankEntry();
            let current = entry.files;
            current = current.filter(i => i.toString() !== document.toString());
            current.unshift(document);
            current.sort();
            entry.files = current;
            bookmark[key] = entry;
            return bookmark;
        };
        export const removeFile = (bookmark: LiveType, key: string, document: vscode.Uri): LiveType =>
        {
            let entry = bookmark[key];
            if (entry)
            {
                let current = entry.files;
                current = current.filter(i => i.toString() !== document.toString());
                current.sort();
                entry.files = current;
                bookmark[key] = entry;
            }
            return bookmark;
        };
    }
    export namespace GlobalBookmark
    {
        const stateKey = `${publisher}.${applicationKey}.grobalBookmark`;
        export const get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(extensionContext.globalState.get<Bookmark.JsonType>(stateKey, {}));
        export const set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            extensionContext.globalState.update(stateKey, Bookmark.liveToJson(bookmark));
        export const addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFolder(get(), key, document));
        export const removeFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFolder(get(), key, document));
        export const addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFile(get(), key, document));
        export const removeFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFile(get(), key, document));
    }
    export namespace WorkspaceBookmark
    {
        const stateKey = `${publisher}.${applicationKey}.grobalBookmark`;
        export const get = (): Bookmark.LiveType =>
            Bookmark.jsonToLive(extensionContext.workspaceState.get<Bookmark.JsonType>(stateKey, {}));
        export const set = (bookmark: Bookmark.LiveType): Thenable<void> =>
            extensionContext.workspaceState.update(stateKey, Bookmark.liveToJson(bookmark));
        export const addFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFolder(get(), key, document));
        export const removeFolder = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFolder(get(), key, document));
        export const addFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.addFile(get(), key, document));
        export const removeFile = (key: string, document: vscode.Uri): Thenable<void> =>
            set(Bookmark.removeFile(get(), key, document));
    }
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
        export const isInPinned = (document: vscode.Uri): boolean =>
            get().some(i => makeSureEndWithSlash(document.path).startsWith(makeSureEndWithSlash(i.path)));
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
            current = current.slice(0, Config.maxRecentlyFiles.get("root-workspace"));
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
        public GlobalBookmark: vscode.TreeItem[];
        public WorkspaceBookmark: vscode.TreeItem[];
        public pinnedExternalFoldersRoot: vscode.TreeItem;
        public pinnedExternalFolders: vscode.TreeItem[];
        public pinnedExternalFilesRoot: vscode.TreeItem;
        public recentlyUsedExternalFilesRoot: vscode.TreeItem;
        constructor()
        {
            this.pinnedExternalFoldersRoot =
            {
                iconPath: vscode.ThemeIcon.Folder,
                label: locale.map("external-files-vscode.externalFolders"),
                description: "Global",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: `${publisher}.${applicationKey}.pinnedExternalFoldersRoot`,
            };
            this.pinnedExternalFilesRoot =
            {
                iconPath: Icons.pinIcon,
                label: locale.map("external-files-vscode.pinnedExternalFiles"),
                description: "Workspace",
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: `${publisher}.${applicationKey}.pinnedExternalFilesRoot`,
            };
            this.recentlyUsedExternalFilesRoot =
            {
                iconPath: Icons.historyIcon,
                label: locale.map("external-files-vscode.recentlyUsedExternalFiles"),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: `${publisher}.${applicationKey}.recentlyUsedExternalFilesRoot`,
            };
            this.update(undefined);
        }
        getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem>
        {
            return element;
        }
        uriToFolderTreeItem = (uri: vscode.Uri, contextValue: string, description?: string): vscode.TreeItem =>
        ({
            iconPath: vscode.ThemeIcon.Folder,
            label: stripDirectory(uri.fsPath),
            resourceUri: uri,
            description,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue,
        });
        uriToFileTreeItem = (uri: vscode.Uri, contextValue: string, description?: string): vscode.TreeItem =>
        ({
            iconPath: vscode.ThemeIcon.File,
            label: stripDirectory(uri.fsPath),
            resourceUri: uri,
            description,
            command:
            {
                title: "show",
                command: "vscode.open",
                arguments:[uri]
            },
            contextValue,
        });
        //bookmarkToTreeItem = (key: string, value: Bookmark.LiveType[string], icon: vscode.IconPath, contextValue: string): vscode.TreeItem[] =>
        async getChildren(element?: vscode.TreeItem | undefined): Promise<vscode.TreeItem[]>
        {
            switch(element?.contextValue)
            {
            case undefined:
                return [
                    this.pinnedExternalFoldersRoot,
                    this.pinnedExternalFilesRoot,
                    this.recentlyUsedExternalFilesRoot
                ];
            case `${publisher}.${applicationKey}.pinnedExternalFoldersRoot`:
                const pinnedExternalFolders = PinnedExternalFolders.get();
                if (0 < pinnedExternalFolders.length)
                {
                    this.pinnedExternalFolders = pinnedExternalFolders.map
                    (
                        i => this.uriToFolderTreeItem
                        (
                            i,
                            `${publisher}.${applicationKey}.pinnedExternalFolder`,
                            stripFileName(i.fsPath)
                        )
                    );
                    return this.pinnedExternalFolders;
                }
                else
                {
                    this.pinnedExternalFolders = [];
                    return [
                        {
                            label: locale.map("noExternalFolders.message"),
                            contextValue: `${publisher}.${applicationKey}.noFiles`,
                        }
                    ];
                }
            case `${publisher}.${applicationKey}.pinnedExternalFolder`:
            case `${publisher}.${applicationKey}.externalFolder`:
                if (element.resourceUri)
                {
                    const subFolders = await getSubFolders(element.resourceUri);
                    const files = await getFiles(element.resourceUri);
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
                return [];
            case `${publisher}.${applicationKey}.pinnedExternalFilesRoot`:
                const pinnedExternalDocuments = PinnedExternalFiles.get();
                return 0 < pinnedExternalDocuments.length ?
                    pinnedExternalDocuments.map
                    (
                        i => this.uriToFileTreeItem
                        (
                            i,
                            `${publisher}.${applicationKey}.pinnedExternalFile`,
                            stripFileName(i.fsPath)
                        )
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
                        i => this.uriToFileTreeItem
                        (
                            i,
                            `${publisher}.${applicationKey}.recentlyUsedExternalFile`,
                            stripFileName(i.fsPath)
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
        getMatchedPinnedExternalFolder= (document: vscode.Uri): vscode.TreeItem | undefined =>
            this.pinnedExternalFolders.find(i => makeSureEndWithSlash(i.resourceUri?.toString() ?? "") === makeSureEndWithSlash(document.toString()));
        updateByUri = (uri: vscode.Uri) =>
            this.update(this.getMatchedPinnedExternalFolder(uri) ?? this.pinnedExternalFoldersRoot);
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
                                    await PinnedExternalFiles.remove(uri);
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
                treeDataProvider.update(undefined);
            }
        }
    }
    const dragAndDropController = new DragAndDropController();
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
            treeDataProvider.update(treeDataProvider.pinnedExternalFoldersRoot);
        }
    };
    export const removeExternalFolder = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        await PinnedExternalFolders.remove(resourceUri);
        treeDataProvider.update(treeDataProvider.pinnedExternalFoldersRoot);
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
                treeDataProvider.update(treeDataProvider.pinnedExternalFilesRoot);
                treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
            }

        }
        else
        {
            if (isExternalFiles(resourceUri))
            {
                await PinnedExternalFiles.add(resourceUri);
                await RecentlyUsedExternalFiles.remove(resourceUri);
                treeDataProvider.update(treeDataProvider.pinnedExternalFilesRoot);
            }
        }
    };
    export const removePinnedFile = async (resourceUri: vscode.Uri): Promise<void> =>
    {
        await PinnedExternalFiles.remove(resourceUri);
        await RecentlyUsedExternalFiles.add(resourceUri);
        treeDataProvider.update(treeDataProvider.pinnedExternalFilesRoot);
        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
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
        const folderPath = await getFolderPath(node.resourceUri);
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
        const folderPath = await getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const newFileName = await vscode.window.showInputBox
            (
                {
                    placeHolder: locale.map("external-files-vscode.newFile.title"),
                    prompt: locale.map("external-files-vscode.newFile.title"),
                }
            );
            if (newFileName)
            {
                const newFileUri = vscode.Uri.joinPath(node.resourceUri, newFileName);
                try
                {
                    await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array());
                    await showTextDocument(newFileUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                treeDataProvider.updateByUri(node.resourceUri);
            }
        }
    };
    export const renameFolder = async (node: any): Promise<void> =>
    {
        const folderPath = await getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const newFolderName = await vscode.window.showInputBox
            (
                {
                    placeHolder: locale.map("external-files-vscode.rename.title"),
                    value: stripDirectory(node.resourceUri.fsPath),
                    prompt: locale.map("external-files-vscode.rename.title"),
                }
            );
            if (newFolderName)
            {
                const newFolderUri = vscode.Uri.joinPath(node.resourceUri, "..", newFolderName);
                try
                {
                    await vscode.workspace.fs.rename(node.resourceUri, newFolderUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                treeDataProvider.updateByUri(node.resourceUri);
            }
        }
    };
    export const removeFolder = async (node: any): Promise<void> =>
    {
        const removeLabel = locale.map("remove.button");
        const confirm = await vscode.window.showWarningMessage
        (
            locale.map("remove.confirm.message"),
            { modal: true },
            removeLabel
        );
        if (removeLabel === confirm)
        {
            try
            {
                await vscode.workspace.fs.delete(node.resourceUri, { useTrash: true, recursive: true });
            }
            catch(error)
            {
                vscode.window.showErrorMessage(error.message);
            }
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const renameFile = async (node: any): Promise<void> =>
    {
        const folderPath = await getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const newFileName = await vscode.window.showInputBox
            (
                {
                    placeHolder: locale.map("external-files-vscode.rename.title"),
                    value: stripDirectory(node.resourceUri.fsPath),
                    prompt: locale.map("external-files-vscode.rename.title"),
                }
            );
            if (newFileName)
            {
                const newFileUri = vscode.Uri.joinPath(node.resourceUri, "..", newFileName);
                try
                {
                    await vscode.workspace.fs.rename(node.resourceUri, newFileUri);
                    await showTextDocument(newFileUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                treeDataProvider.updateByUri(node.resourceUri);
            }
        }
    };
    export const removeFile = async (node: any): Promise<void> =>
    {
        const removeLabel = locale.map("remove.button");
        const confirm = await vscode.window.showWarningMessage
        (
            locale.map("remove.confirm.message"),
            { modal: true },
            removeLabel
        );
        if (removeLabel === confirm)
        {
            try
            {
                await vscode.workspace.fs.delete(node.resourceUri, { useTrash: true });
            }
            catch(error)
            {
                vscode.window.showErrorMessage(error.message);
            }
            treeDataProvider.updateByUri(node.resourceUri);
        }
    };
    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        Icons.initialize(context);
        treeDataProvider = new ExternalFilesProvider();
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(`${applicationKey}.addExternalFolder`, addExternalFolder),
            vscode.commands.registerCommand(`${applicationKey}.reloadExternalFolder`, _ => treeDataProvider.update(treeDataProvider.pinnedExternalFoldersRoot)),
            vscode.commands.registerCommand(`${applicationKey}.removeExternalFolder`, node => removeExternalFolder(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.removePinnedFile`, node => removePinnedFile(node.resourceUri)),
            vscode.commands.registerCommand(`${applicationKey}.addPinnedFile`, node => addPinnedFile(node.resourceUri)),
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
                        onDidChangeConfiguration();
                    }
                }
            ),
            vscode.workspace.onDidChangeWorkspaceFolders(_ => treeDataProvider.update(undefined)),
        );
        //RecentlyUsedExternalFiles.clear();
        updateViewOnExplorer();
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
            treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
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
    const stripFileName = (path: string): string =>
        path.substr(0, path.length -stripDirectory(path).length);
    const stripDirectory = (path: string): string =>
        path.split('\\').reverse()[0].split('/').reverse()[0];
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
