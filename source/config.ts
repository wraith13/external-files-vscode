import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
export namespace Config
{
    const root = vscel.config.makeRoot(packageJson);
    export const maxRecentlyFiles = root.makeEntry<number>("external-files.maxRecentlyFiles", "root-workspace");
}
