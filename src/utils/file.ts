import { App, TFile } from "obsidian";
import { Logger } from "../logger";

export function getCharacterNotePath(app: App, sourcePath: string, characterName: string): string {
    const plugin = (app as any).plugins.getPlugin("fountain") || (app as any).plugins.plugins["fountain"];
    let folder = plugin?.settings?.characterNotesFolder?.trim() || "";
    
    const sourceDir = sourcePath.includes("/") ? sourcePath.substring(0, sourcePath.lastIndexOf("/")) : "";

    let targetDir = folder;
    if (folder.startsWith("/")) {
        targetDir = folder.substring(1);
    } else if (folder.startsWith("./")) {
        targetDir = sourceDir ? `${sourceDir}/${folder.substring(2)}` : folder.substring(2);
    } else if (folder) {
        targetDir = sourceDir ? `${sourceDir}/${folder}` : folder;
    } else {
        targetDir = sourceDir;
    }

    if (targetDir && !targetDir.endsWith("/")) {
        targetDir += "/";
    }

    const defaultPath = `${targetDir}${characterName}.md`.replace(/\/+/g, "/");

    const normalizedTarget = targetDir.replace(/\/+/g, "/");

    // Deterministic scan of target directory files for alias matching
    const markdownFiles = app.vault.getMarkdownFiles();
    const characterLower = characterName.toLowerCase();
    
    for (const file of markdownFiles) {
        if (normalizedTarget ? file.path.startsWith(normalizedTarget) : !file.path.includes("/")) {
            const cache = app.metadataCache.getFileCache(file);
            if (cache && cache.frontmatter) {
                let aliases = cache.frontmatter.aliases;
                if (aliases) {
                    if (typeof aliases === "string") {
                        aliases = [aliases];
                    }
                    if (Array.isArray(aliases)) {
                        const hasAlias = aliases.some(alias => 
                            typeof alias === "string" && alias.trim().toLowerCase() === characterLower
                        );
                        if (hasAlias) {
                            return file.path;
                        }
                    }
                }
            }
        }
    }

    return defaultPath;
}

export async function getOrCreateCharacterNote(app: App, sourcePath: string, characterName: string): Promise<TFile | null> {
    const exactPath = getCharacterNotePath(app, sourcePath, characterName);
    let file = app.vault.getAbstractFileByPath(exactPath);
    
    if (!file || ("children" in file)) {
        const targetDir = exactPath.substring(0, exactPath.lastIndexOf("/"));
        if (targetDir) {
            const folders = targetDir.split("/");
            let currentPath = "";
            for (const f of folders) {
                currentPath = currentPath ? `${currentPath}/${f}` : f;
                const exists = await app.vault.adapter.exists(currentPath);
                if (!exists) {
                    try {
                        await app.vault.createFolder(currentPath);
                    } catch (e) {
                        // Ignore race condition if folder was created simultaneously
                    }
                }
            }
        }
        try {
            file = await app.vault.create(exactPath, "");
        } catch (e) {
            file = app.vault.getAbstractFileByPath(exactPath);
        }
    }
    
    if (file && !("children" in file)) {
        return file as TFile;
    }
    return null;
}

export async function renameCharacterFile(app: App, oldPath: string, newName: string): Promise<TFile | null> {
    const file = app.vault.getAbstractFileByPath(oldPath);
    if (file && !("children" in file)) {
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
        const newPath = parentDir ? `${parentDir}/${newName}.md` : `${newName}.md`;
        
        try {
            await app.fileManager.renameFile(file, newPath);
            return app.vault.getAbstractFileByPath(newPath) as TFile;
        } catch (e) {
            Logger.error("file_utility", `Failed to rename character note: ${oldPath} to ${newPath}`, e);
        }
    }
    return null;
}
