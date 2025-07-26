import * as vscode from 'vscode';
import { Application } from './application';
import { ExternalFiles } from './extension';
export const activate = (context: vscode.ExtensionContext) : void =>
{
    Application.context = context;
    ExternalFiles.initialize(context);
};
export const deactivate = () : void =>
{
};
