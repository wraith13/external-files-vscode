import * as vscel from '@wraith13/vscel';
import { Application } from './application';
import packageJson from "../package.json";
export namespace Config
{
    const root = vscel.config.makeRoot(packageJson);
    export const maxRecentlyFiles = root.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
    const recentlyFilesHistoryScopeObject = Object.freeze
    ({
        "global": () => Application.context.globalState,
        "workspace": () => Application.context.workspaceState,
    });
    export const recentlyFilesHistoryScope = root.makeMapEntry("external-files.recentlyFilesHistoryScope", "root-workspace", recentlyFilesHistoryScopeObject);
}
