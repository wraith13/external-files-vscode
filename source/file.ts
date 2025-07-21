import * as vscode from "vscode";
import { locale } from "./locale";
export namespace File
{
    export const regulateName = (key: string): string =>
        key.trim().replace(/[\s]+/g, " ");
    export const stripFileName = (path: string): string =>
        path.slice(0, path.length -stripDirectory(path).length);
    export const stripDirectory = (path: string): string =>
        path.split('\\').reverse()[0].split('/').reverse()[0];
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
                vscode.window.showErrorMessage(`Unknown file stat: ${stat.type}`);
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
    export const newFolder = async (node: any): Promise<boolean> =>
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
                return true;
            }
        }
        return false;
    };
    export const newFile = async (node: any): Promise<boolean> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
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
                    await vscode.window.showTextDocument(newFileUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                return true;
            }
        }
        return false;
    };
    export const renameFolder = async (node: any): Promise<boolean> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
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
                return true;
            }
        }
        return false;
    };
    export const removeFolder = async (node: any): Promise<boolean> =>
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
            return true;
        }
        return false;
    };
    export const renameFile = async (node: any): Promise<boolean> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
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
                    await vscode.window.showTextDocument(newFileUri);
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
                return true;
            }
        }
        return false;
    };
    export const removeFile = async (node: any): Promise<boolean> =>
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
            return true;
        }
        return false;
    };
}