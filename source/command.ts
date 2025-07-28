import * as vscode from 'vscode';
import { undefinedable } from "./undefinedable";
import { String } from "./string";
import { locale } from "./locale";
import { File } from "./file";
import { Bookmark } from "./bookmark";
import { Recentlies } from "./recentlies";
import { errorDecorationProvider } from "./file-decoration-provider";
import { treeDataProvider } from "./tree-data-provider";
export namespace Commands
{
    export const onDidChangeUri = (oldUri: vscode.Uri, newUri: vscode.Uri | "removed"): boolean =>
        [
            Bookmark.global.onDidChangeUri(oldUri, newUri),
            Bookmark.workspace.onDidChangeUri(oldUri, newUri),
            Recentlies.onDidChangeUri(oldUri, newUri),
        ]
        .some(i => i);
    export const newBookmarkKey = async (bookmark: Bookmark.Instance): Promise<void> =>
    {
        const newKey = undefinedable(String.regulateName)
        (
            await vscode.window.showInputBox
            (
                {
                    placeHolder: locale.map("newBookmark.placeHolder"),
                    prompt: locale.map("external-files-vscode.addNewGlobalBookmark.title"),
                }
            )
        );
        if (String.isValid(newKey))
        {
            if (bookmark.hasKey(newKey))
            {
                vscode.window.showErrorMessage(locale.map("external-files-vscode.rename.error.duplicate"));
            }
            else
            {
                await bookmark.addKey(newKey);
                treeDataProvider.update(undefined);
            }
        }
    };
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
                await newBookmarkKey(Bookmark.global);
                break;
            case "new-workspace":
                await newBookmarkKey(Bookmark.workspace);
                break;
            default:
                break;
            }
        }
    };
    export const reloadAll = async (): Promise<void> =>
        treeDataProvider.update(undefined);
    export const renameBookmarkKey = async (bookmark: Bookmark.Instance, bookmarkUri: vscode.Uri): Promise<void> =>
    {
        const oldBookmarkKey = bookmark.getKeyFromUri(bookmarkUri);
        if (oldBookmarkKey)
        {
            const newBookmarkKey = undefinedable(String.regulateName)
            (
                await vscode.window.showInputBox
                (
                    {
                        placeHolder: locale.map("external-files-vscode.rename.title"),
                        value: oldBookmarkKey,
                        prompt: locale.map("external-files-vscode.rename.title"),
                    }
                )
            );
            if (String.isValid(newBookmarkKey) && oldBookmarkKey !== newBookmarkKey)
            {
                if (bookmark.hasKey(newBookmarkKey))
                {
                    vscode.window.showErrorMessage(locale.map("external-files-vscode.rename.error.duplicate"));
                }
                else
                {
                    await bookmark.renameKey(oldBookmarkKey, newBookmarkKey);
                    treeDataProvider.update(undefined);
                }
            }
        }
    }
    export const renameBookmark = async (node: any): Promise<void> =>
    {
        const bookmarkUri = node.resourceUri;
        if (bookmarkUri instanceof vscode.Uri)
        {
            await renameBookmarkKey(Bookmark.global, bookmarkUri);
            await renameBookmarkKey(Bookmark.workspace, bookmarkUri);
        }
    };
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
    export const addExternalFilesOrFolders = async (foldersOrFiles: "files" | "folders", node: any): Promise<void> =>
    {
        const files = await vscode.window.showOpenDialog
        (
            {
                canSelectFiles: "files" === foldersOrFiles,
                canSelectFolders: "folders" === foldersOrFiles,
                canSelectMany: true,
                openLabel: locale.map("external-files-vscode.addExternalFiles.button"),
                title: "files" === foldersOrFiles ?
                    locale.map("external-files-vscode.addExternalFiles.title"):
                    locale.map("external-files-vscode.addExternalFolders.title"),
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
    export const addExternalFiles = async (node: any): Promise<void> =>
        await addExternalFilesOrFolders("files", node);
    export const addExternalFolders = async (node: any): Promise<void> =>
        await addExternalFilesOrFolders("folders", node);
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
                    const newKey = undefinedable(String.regulateName)
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
                    const newKey = undefinedable(String.regulateName)
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
}