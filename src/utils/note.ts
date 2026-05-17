import { App, TFile } from "obsidian";

/**
 * Safely adds an alias to the YAML frontmatter of a Markdown file
 * using Obsidian's native, robust processFrontMatter API.
 */
export async function addFrontmatterAlias(app: App, file: TFile, alias: string): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    let aliases = frontmatter.aliases || [];
    if (typeof aliases === "string") {
      aliases = [aliases];
    }
    if (!aliases.includes(alias)) {
      aliases.push(alias);
    }
    frontmatter.aliases = aliases;
  });
}

/**
 * Dynamically appends a backlink pointing to the active screenplay file
 * under a structured, footer-like "---" and "**Screenplay Backlinks**" bold label.
 * This bridges plain-text screenplay files with Obsidian's graph view and backlinks.
 */
export async function ensureScreenplayReference(app: App, file: TFile, sourcePath: string): Promise<void> {
  const content = await app.vault.read(file);
  const heading = "**Screenplay Backlinks**";
  const divider = "---";
  const refLink = `* [[${sourcePath}]]`;

  if (content.includes(refLink)) {
    return; // Link is already registered
  }

  let newContent = content;
  const headingIndex = content.indexOf(heading);

  if (headingIndex === -1) {
    // Heading doesn't exist. Append it at the bottom.
    if (newContent && !newContent.endsWith("\n")) {
      newContent += "\n";
    }
    newContent += `\n${divider}\n${heading}\n${refLink}\n`;
  } else {
    // Heading exists. Insert the link in the references section block.
    const beforeHeading = content.substring(0, headingIndex + heading.length);
    const afterHeading = content.substring(headingIndex + heading.length);

    // Identify if there are any subsequent headings or dividers, so we insert before them.
    const nextSectionMatch = afterHeading.match(/\n(#+|\-\-\-)/);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const sectionContent = afterHeading.substring(0, nextSectionMatch.index);
      const remainder = afterHeading.substring(nextSectionMatch.index);

      let updatedSection = sectionContent;
      if (updatedSection && !updatedSection.endsWith("\n")) {
        updatedSection += "\n";
      }
      updatedSection += `${refLink}\n`;

      newContent = beforeHeading + updatedSection + remainder;
    } else {
      // No subsequent sections. Append to the end of the section.
      let updatedAfter = afterHeading;
      if (updatedAfter && !updatedAfter.endsWith("\n")) {
        updatedAfter += "\n";
      }
      updatedAfter += `${refLink}\n`;

      newContent = beforeHeading + updatedAfter;
    }
  }

  await app.vault.modify(file, newContent);
}
