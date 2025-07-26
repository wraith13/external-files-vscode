import * as vscode from "vscode";
import { undefinedable } from "./undefinedable";
import { regulateName } from "./regulate-name";
import { locale } from "./locale";
export namespace File
{
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
    export const getFoldersAndFiles = async (uri: vscode.Uri): Promise<undefined | { folders:vscode.Uri[]; files:vscode.Uri[]}> =>
    {
        if (await isFolder(uri))
        {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            const folders: vscode.Uri[] = [];
            const files: vscode.Uri[] = [];
            for (const entry of entries)
            {
                switch(await isFolderOrFile(vscode.Uri.joinPath(uri, entry[0])))
                {
                case "folder":
                    folders.push(vscode.Uri.joinPath(uri, entry[0]));
                    break;
                case "file":
                    files.push(vscode.Uri.joinPath(uri, entry[0]));
                    break;
                default:
                    //vscode.window.showErrorMessage(`Unknown file stat for ${entry[0]}`);
                    break;
                }
            }
            return { folders, files };
        }
        return undefined;
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
            const newFolderName = undefinedable(regulateName)
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
            const newFileName = undefinedable(regulateName)
            (
                await vscode.window.showInputBox
                (
                    {
                        placeHolder: locale.map("external-files-vscode.newFile.title"),
                        prompt: locale.map("external-files-vscode.newFile.title"),
                    }
                )
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
    export const renameFolder = async (node: any): Promise<vscode.Uri | undefined> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const oldFolderName = stripDirectory(node.resourceUri.fsPath);
            const newFolderName = undefinedable(regulateName)
            (
                await vscode.window.showInputBox
                (
                    {
                        placeHolder: locale.map("external-files-vscode.rename.title"),
                        value: oldFolderName,
                        prompt: locale.map("external-files-vscode.rename.title"),
                    }
                )
            );
            if (newFolderName && oldFolderName !== newFolderName)
            {
                const newFolderUri = vscode.Uri.joinPath(node.resourceUri, "..", newFolderName);
                try
                {
                    await vscode.workspace.fs.rename(node.resourceUri, newFolderUri);
                    return newFolderUri;
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
            }
        }
        return undefined;
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
    export const renameFile = async (node: any): Promise<vscode.Uri | undefined> =>
    {
        const folderPath = await File.getFolderPath(node.resourceUri);
        if (folderPath)
        {
            const oldFileName = stripDirectory(node.resourceUri.fsPath);
            const newFileName = undefinedable(regulateName)
            (
                await vscode.window.showInputBox
                (
                    {
                        placeHolder: locale.map("external-files-vscode.rename.title"),
                        value: oldFileName,
                        prompt: locale.map("external-files-vscode.rename.title"),
                    }
                )
            );
            if (newFileName && oldFileName !== newFileName)
            {
                const newFileUri = vscode.Uri.joinPath(node.resourceUri, "..", newFileName);
                try
                {
                    await vscode.workspace.fs.rename(node.resourceUri, newFileUri);
                    return newFileUri;
                }
                catch(error)
                {
                    vscode.window.showErrorMessage(error.message);
                }
            }
        }
        return undefined;
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