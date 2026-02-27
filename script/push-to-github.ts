import { getUncachableGitHubClient } from "../server/github";
import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", ".local", ".cache", ".config", ".upm", "server/public", ".replit"]);
const IGNORE_FILES = new Set([".DS_Store", "replit.nix", ".replit", ".breakpoints"]);

function getAllFiles(dir: string, base: string = ""): { path: string; fullPath: string }[] {
  const files: { path: string; fullPath: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(relPath) || IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      files.push(...getAllFiles(path.join(dir, entry.name), relPath));
    } else {
      if (IGNORE_FILES.has(entry.name) || entry.name.endsWith(".tar.gz")) continue;
      files.push({ path: relPath, fullPath: path.join(dir, entry.name) });
    }
  }
  return files;
}

async function main() {
  const octokit = await getUncachableGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = "lindsays-ppt-to-png-converter";
  console.log(`Pushing to https://github.com/${owner}/${repo}`);

  const files = getAllFiles("/home/runner/workspace");
  console.log(`Found ${files.length} files to upload`);

  // Initialize empty repo with a first commit
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: ".gitkeep",
      message: "Initialize repository",
      content: Buffer.from("").toString("base64"),
    });
    console.log("Repository initialized");
  } catch (e: any) {
    console.log("Repo already initialized, continuing...");
  }

  const blobs = [];
  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: content.toString("base64"),
      encoding: "base64",
    });
    blobs.push({ path: file.path, sha: blob.sha, mode: "100644" as const, type: "blob" as const });
    process.stdout.write(".");
  }
  console.log("\nBlobs created");

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: blobs,
  });
  console.log("Tree created:", tree.sha);

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: "Lindsay's PPT to PNG Converter - initial upload",
    tree: tree.sha,
    parents: [],
  });
  console.log("Commit created:", commit.sha);

  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: "heads/main",
      sha: commit.sha,
      force: true,
    });
  } catch {
    await octokit.git.createRef({
      owner,
      repo,
      ref: "refs/heads/main",
      sha: commit.sha,
    });
  }

  console.log(`\nDone! Your repo: https://github.com/${owner}/${repo}`);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
