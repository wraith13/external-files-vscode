import * as vscode from 'vscode';
import { Application } from './application';
import { undefinedable } from "./undefinedable";
import { File } from "./file";
import { Bookmark } from "./bookmark";
import { Recentlies } from "./recentlies";
import { treeDataProvider } from "./tree-data-provider";
export class DragAndDropController implements vscode.TreeDragAndDropController<vscode.TreeItem>
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
                                if (Application.isExternalFiles(uri) && undefined !== await File.isFolderOrFile(uri))
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
                                if (Application.isExternalFiles(uri) && undefined !== await File.isFolderOrFile(uri))
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
                            if (Application.isExternalFiles(uri) && await File.isFile(uri))
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
export const dragAndDropController = new DragAndDropController();
