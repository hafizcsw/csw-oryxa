import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const PROJECT_ROOT = process.cwd();
const DEFAULT_REPOSITORY = "hafizcsw/csw-world";
const DEFAULT_REF = "main";
const PROTECTED_PATHS = [
  ".env",
  ".git",
  ".gitignore",
  ".lovable",
  "bun.lock",
  "bun.lockb",
  "dist",
  "node_modules",
  "package-lock.json",
  "src/integrations/supabase/client.ts",
  "src/integrations/supabase/types.ts",
  "supabase/config.toml",
];
const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getOption(name, fallback) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }

  return fallback;
}

function normalizeRelativePath(relativePath) {
  return relativePath.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function parseRepository(input) {
  const normalized = input
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");

  const [owner, repo] = normalized.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository value: ${input}`);
  }

  return { owner, repo, slug: `${owner}/${repo}` };
}

function isProtected(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return PROTECTED_PATHS.some((protectedPath) => {
    const protectedNormalized = normalizeRelativePath(protectedPath);
    return normalized === protectedNormalized || normalized.startsWith(`${protectedNormalized}/`);
  });
}

async function collectEntries(rootDir, currentRelative = "") {
  const absoluteDir = currentRelative ? path.join(rootDir, currentRelative) : rootDir;
  const entries = await fsp.readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  const directories = [];

  for (const entry of entries) {
    const relativePath = normalizeRelativePath(currentRelative ? `${currentRelative}/${entry.name}` : entry.name);
    if (!relativePath || isProtected(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      directories.push(relativePath);
      const nested = await collectEntries(rootDir, relativePath);
      files.push(...nested.files);
      directories.push(...nested.directories);
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return { files, directories };
}

async function pathKind(targetPath) {
  try {
    const stats = await fsp.lstat(targetPath);
    if (stats.isDirectory()) return "directory";
    if (stats.isFile()) return "file";
    return "other";
  } catch {
    return null;
  }
}

async function filesAreEqual(sourcePath, destinationPath) {
  try {
    const [sourceStats, destinationStats] = await Promise.all([fsp.stat(sourcePath), fsp.stat(destinationPath)]);
    if (sourceStats.size !== destinationStats.size) {
      return false;
    }

    const [sourceContent, destinationContent] = await Promise.all([
      fsp.readFile(sourcePath),
      fsp.readFile(destinationPath),
    ]);

    return sourceContent.equals(destinationContent);
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath) {
  const kind = await pathKind(targetPath);
  if (kind === "file") {
    await fsp.rm(targetPath, { force: true });
  }

  await fsp.mkdir(targetPath, { recursive: true });
}

async function copyFileIntoPlace(sourcePath, destinationPath) {
  await ensureDirectory(path.dirname(destinationPath));

  const kind = await pathKind(destinationPath);
  if (kind === "directory") {
    await fsp.rm(destinationPath, { recursive: true, force: true });
  }

  await fsp.copyFile(sourcePath, destinationPath);
}

async function downloadTarball(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "lovable-canonical-sync",
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url} [${response.status}]`);
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destinationPath));
}

async function main() {
  const repositoryInput = getOption("--repo", DEFAULT_REPOSITORY);
  const ref = getOption("--ref", DEFAULT_REF);
  const dryRun = hasFlag("--dry-run");
  const keepExtraneous = hasFlag("--no-delete");
  const { owner, repo, slug } = parseRepository(repositoryInput);
  const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${ref}`;
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "canonical-sync-"));
  const archivePath = path.join(tempRoot, "repo.tar.gz");

  console.log(`[canonical-sync] source=${slug} ref=${ref} mode=${dryRun ? "dry-run" : "apply"}`);
  console.log(`[canonical-sync] downloading ${tarballUrl}`);

  try {
    await downloadTarball(tarballUrl, archivePath);

    const extraction = spawnSync("tar", ["-xzf", archivePath, "-C", tempRoot], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });

    if (extraction.status !== 0) {
      throw new Error(extraction.stderr || "Failed to extract repository archive");
    }

    const extractedDirectory = (await fsp.readdir(tempRoot, { withFileTypes: true })).find(
      (entry) => entry.isDirectory() && entry.name !== ".git"
    );

    if (!extractedDirectory) {
      throw new Error("Unable to locate extracted repository contents");
    }

    const sourceRoot = path.join(tempRoot, extractedDirectory.name);
    const remoteEntries = await collectEntries(sourceRoot);
    const localEntries = await collectEntries(PROJECT_ROOT);
    const remoteFileSet = new Set(remoteEntries.files);
    const remoteDirectorySet = new Set(remoteEntries.directories);
    const summary = {
      created: 0,
      updated: 0,
      unchanged: 0,
      deletedFiles: 0,
      deletedDirectories: 0,
      sourceFiles: remoteEntries.files.length,
      sourceDirectories: remoteEntries.directories.length,
    };

    for (const relativeDirectory of remoteEntries.directories) {
      const destinationDirectory = path.join(PROJECT_ROOT, relativeDirectory);
      if (!dryRun) {
        await ensureDirectory(destinationDirectory);
      }
    }

    for (const relativeFile of remoteEntries.files) {
      const sourceFile = path.join(sourceRoot, relativeFile);
      const destinationFile = path.join(PROJECT_ROOT, relativeFile);
      const exists = await pathKind(destinationFile);
      const equal = exists === "file" ? await filesAreEqual(sourceFile, destinationFile) : false;

      if (equal) {
        summary.unchanged += 1;
        continue;
      }

      if (exists) {
        summary.updated += 1;
      } else {
        summary.created += 1;
      }

      if (!dryRun) {
        await copyFileIntoPlace(sourceFile, destinationFile);
      }
    }

    if (!keepExtraneous) {
      for (const relativeFile of localEntries.files) {
        if (remoteFileSet.has(relativeFile)) {
          continue;
        }

        summary.deletedFiles += 1;
        if (!dryRun) {
          await fsp.rm(path.join(PROJECT_ROOT, relativeFile), { force: true });
        }
      }

      const orderedDirectories = [...localEntries.directories].sort((left, right) => right.length - left.length);
      for (const relativeDirectory of orderedDirectories) {
        if (remoteDirectorySet.has(relativeDirectory)) {
          continue;
        }

        const absoluteDirectory = path.join(PROJECT_ROOT, relativeDirectory);
        const remainingEntries = await fsp.readdir(absoluteDirectory).catch(() => []);
        if (remainingEntries.length > 0) {
          continue;
        }

        summary.deletedDirectories += 1;
        if (!dryRun) {
          await fsp.rmdir(absoluteDirectory).catch(() => undefined);
        }
      }
    }

    console.log(`[canonical-sync] protected=${PROTECTED_PATHS.join(", ")}`);
    console.log(`[canonical-sync] sourceFiles=${summary.sourceFiles} sourceDirectories=${summary.sourceDirectories}`);
    console.log(
      `[canonical-sync] created=${summary.created} updated=${summary.updated} unchanged=${summary.unchanged} deletedFiles=${summary.deletedFiles} deletedDirectories=${summary.deletedDirectories}`
    );
    console.log(`[canonical-sync] ${dryRun ? "Dry run complete." : "Sync complete."}`);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[canonical-sync] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
