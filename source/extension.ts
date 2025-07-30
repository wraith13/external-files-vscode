'use strict';
import * as vscode from 'vscode';
import { Application } from './application';
import { Icons } from "./icon"
import { Bookmark } from "./bookmark";
import { Recentlies } from "./recentlies";
import { errorDecorationProvider } from "./file-decoration-provider";
import { treeDataProvider } from "./tree-data-provider";
import { dragAndDropController } from "./tree-drag-and-drop-controller";
import { Commands } from "./command";
import packageJson from "../package.json";
export const activate = (context: vscode.ExtensionContext) : void =>
{
    Application.context = context;
    Icons.initialize(context);
    context.subscriptions.push
    (
        vscode.commands.registerCommand(`${Application.key}.newBookmark`, Commands.newBookmark),
        vscode.commands.registerCommand(`${Application.key}.reloadAll`, Commands.reloadAll),
        vscode.commands.registerCommand(`${Application.key}.renameBookmark`, Commands.renameBookmark),
        vscode.commands.registerCommand(`${Application.key}.removeBookmark`, Commands.removeBookmark),
        vscode.commands.registerCommand(`${Application.key}.clearHistory`, Commands.clearHistory),
        vscode.commands.registerCommand(`${Application.key}.addExternalFiles`, Commands.addExternalFiles),
        vscode.commands.registerCommand(`${Application.key}.addExternalFolders`, Commands.addExternalFolders),
        vscode.commands.registerCommand(`${Application.key}.registerToBookmark`, node => Commands.registerToBookmark(node.resourceUri)),
        vscode.commands.registerCommand(`${Application.key}.newFile`, Commands.newFile),
        vscode.commands.registerCommand(`${Application.key}.newFolder`, Commands.newFolder),
        vscode.commands.registerCommand(`${Application.key}.revealFileInFinder`, Commands.makeCommand("revealFileInOS")),
        vscode.commands.registerCommand(`${Application.key}.revealFileInExplorer`, Commands.makeCommand("revealFileInOS")),
        vscode.commands.registerCommand(`${Application.key}.showActiveFileInExplorer`, Commands.makeCommand("workbench.files.action.showActiveFileInExplorer", "withActivate")),
        vscode.commands.registerCommand(`${Application.key}.revealInTerminal`, node => Commands.revealInTerminal(node.resourceUri)),
        vscode.commands.registerCommand(`${Application.key}.copyFilePath`, Commands.makeCommand("copyFilePath")),
        vscode.commands.registerCommand(`${Application.key}.renameFolder`, Commands.renameFolder),
        vscode.commands.registerCommand(`${Application.key}.removeFolder`, Commands.removeFolder),
        vscode.commands.registerCommand(`${Application.key}.renameFile`, Commands.renameFile),
        vscode.commands.registerCommand(`${Application.key}.removeFile`, Commands.removeFile),
        vscode.commands.registerCommand(`${Application.key}.hideFileType`, Commands.hideFileType),
        vscode.commands.registerCommand(`${Application.key}.reload`, Commands.reload),
        vscode.commands.registerCommand(`${Application.key}.removeExternalFile`, Commands.removeExternalFiles),
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
                    treeDataProvider.update(undefined);
                }
            }
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(_ => treeDataProvider.update(undefined)),
        vscode.window.onDidChangeWindowState
        (
            state =>
            {
                if (state.focused)
                {
                    if (Bookmark.global.isUpdated())
                    {
                        Bookmark.global.updateCache();
                        treeDataProvider.update(undefined);
                    }
                }
            }
        )
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
    Bookmark.global.updateCache();
    treeDataProvider.update(undefined);
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
};
const onDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined): void =>
{
    let isRecentlyUsedExternalFile = false;
    if (editor && Application.isRegularTextEditor(editor))
    {
        isRecentlyUsedExternalFile = Application.isExternalDocuments(editor.document);
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
    if (Application.isExternalDocuments(document))
    {
        await Recentlies.add(document.uri);
        treeDataProvider.update(treeDataProvider.recentlyUsedExternalFilesRoot);
    }
};
export const deactivate = () : void =>
{
};
