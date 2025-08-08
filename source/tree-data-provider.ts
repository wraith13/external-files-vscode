import * as vscode from "vscode";
import { Application } from './application';
import { Config } from './config';
import { String } from "./string";
import { locale } from "./locale";
import { Icons } from "./icon"
import { File } from "./file";
import { Favorites } from "./favorites";
import { Bookmark } from "./bookmark";
import { Recentlies } from "./recentlies";
import { errorDecorationProvider } from "./file-decoration-provider";
export interface ExtendedTreeItem extends vscode.TreeItem
{
    parent?: vscode.TreeItem;
}
class ExternalFilesProvider implements vscode.TreeDataProvider<ExtendedTreeItem>
{
    private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;
    public favoritesRoot: vscode.TreeItem;
    public globalBookmark: { [key: string]: vscode.TreeItem; };
    public workspaceBookmark: { [key: string]: vscode.TreeItem; };
    public recentlyUsedExternalFilesRoot: vscode.TreeItem;
    constructor() { }
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
    orEmptyMessage = (source: ExtendedTreeItem[], parent?: vscode.TreeItem): ExtendedTreeItem[] =>
        0 < source.length ?
            source:
            [{
                label: locale.map("noExternalFiles.message"),
                contextValue: Application.makeKey("noFiles"),
                parent,
            }];
    async getChildren(parent?: vscode.TreeItem | undefined): Promise<ExtendedTreeItem[]>
    {
        switch(parent?.contextValue)
        {
        case undefined:
            this.favoritesRoot =
            {
                iconPath: Icons.star,
                label: locale.map("external-files-vscode.favorites"),
                description: locale.map(`scope.${Config.favoritesScope.getKey()}`),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: Application.makeKey("favoritesRoot"),
                resourceUri: Favorites.getUri(),
            };
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
            this.recentlyUsedExternalFilesRoot =
            {
                iconPath: Icons.history,
                label: locale.map("external-files-vscode.recentlyUsedExternalFiles"),
                description: locale.map(`scope.${Config.recentlyFilesHistoryScope.getKey()}`),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: Application.makeKey("recentlyUsedExternalFilesRoot"),
                resourceUri: Recentlies.getUri(),
            };
            return [
                ...Config.favoritesScope.get().isShow ?
                    [ this.favoritesRoot, ]: [],
                ...Object.values(this.globalBookmark),
                ...Object.values(this.workspaceBookmark),
                ...Config.recentlyFilesHistoryScope.get().isShow ?
                    [ this.recentlyUsedExternalFilesRoot, ]: [],
            ];
        case Application.makeKey("favoritesRoot"):
            const entries = await Favorites.getEntries(Favorites.get());
            errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
            errorDecorationProvider.addErrorUris(entries.unknowns);
            return this.orEmptyMessage
            (
                [
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
                ],
                parent
            );
        case Application.makeKey("globalBookmark"):
            if ("string" === typeof parent.label && this.globalBookmark[parent.label])
            {
                const entries = await Bookmark.global.getEntries(parent.label);
                errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                errorDecorationProvider.addErrorUris(entries.unknowns);
                return this.orEmptyMessage
                (
                    [
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
                    ],
                    parent
                );
            }
            return [];
        case Application.makeKey("workspaceBookmark"):
            if ("string" === typeof parent.label && this.workspaceBookmark[parent.label])
            {
                const entries = await Bookmark.workspace.getEntries(parent.label);
                errorDecorationProvider.removeErrorUris([ ...entries.folders, ...entries.files, ]);
                errorDecorationProvider.addErrorUris(entries.unknowns);
                return this.orEmptyMessage
                (
                        [
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
                    ],
                    parent
                );
            }
            return [];
        case Application.makeKey("rootExternalFolder"):
        case Application.makeKey("externalFolder"):
            if (parent.resourceUri)
            {
                try
                {
                    const filesAndFolders = await File.getFoldersAndFiles(parent.resourceUri, Config.hiddenFiles.get());
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
                ),
                parent
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
                    if (String.makeSureEndWithSlash(uri.toString()).startsWith(String.makeSureEndWithSlash(folder.toString())))
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
    updateFavorites = async (): Promise<void> =>
        this.update(this.favoritesRoot);
    updateGlobalBookmark = async (key: string): Promise<void> =>
        this.update(this.globalBookmark[key]);
    updateWorkspaceBookmark = async (key: string): Promise<void> =>
        this.update(this.workspaceBookmark[key]);
}
export const treeDataProvider = new ExternalFilesProvider();
