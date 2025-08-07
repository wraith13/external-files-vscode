import * as vscel from '@wraith13/vscel';
import { Application } from './application';
import packageJson from "../package.json";
export namespace Config
{
    const root = vscel.config.makeRoot(packageJson);
    const scopeObject = Object.freeze
    ({
        "none":
        {
            isShow: false,
            getState: () => Application.context.globalState,
        },
        "global":
        {
            isShow: true,
            getState: () => Application.context.globalState,
        },
        "workspace":
        {
            isShow: true,
            getState: () => Application.context.workspaceState,
        },
    });
    export const favoritesScope = root.makeMapEntry("external-files.favoritesScope", "root-workspace", scopeObject);
    export const recentlyFilesHistoryScope = root.makeMapEntry("external-files.recentlyFilesHistoryScope", "root-workspace", scopeObject);
    export const maxRecentlyFiles = root.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
    export const hiddenFiles = root.makeEntry<string[]>("external-files.hiddenFiles", "root-workspace");
}
