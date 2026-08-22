import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export class FrameworkError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "FrameworkError";
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, code, message, details = undefined) {
  if (!condition) {
    throw new FrameworkError(code, message, details);
  }
}

export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    assert(key.length > 0, "INVALID_ARGUMENT", "Empty flag name is not allowed.");
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { positionals, flags };
}

export function requireFlag(flags, name) {
  const value = flags[name];
  assert(typeof value === "string" && value.length > 0, "MISSING_ARGUMENT", `--${name} is required.`);
  return value;
}

export function optionalFlag(flags, name, fallback = undefined) {
  const value = flags[name];
  return typeof value === "string" ? value : fallback;
}

export function resolveRoot(value) {
  return path.resolve(value ?? process.cwd());
}

export function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const prefix = `${path.resolve(root)}${path.sep}`;
  assert(resolved === path.resolve(root) || resolved.startsWith(prefix), "PATH_ESCAPE", `Path escapes repository root: ${relativePath}`);
  return resolved;
}

export async function assertNoSymlinkPath(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const resolved = resolveInside(absoluteRoot, relativePath);
  const relative = path.relative(absoluteRoot, resolved);
  let cursor = absoluteRoot;
  for (const part of ["", ...relative.split(path.sep).filter(Boolean)]) {
    if (part) cursor = path.join(cursor, part);
    try {
      const value = await lstat(cursor);
      assert(!value.isSymbolicLink(), "SYMLINK_PATH", `Framework authority may not traverse a symlink: ${cursor}`);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
  return resolved;
}

export function normalizeLf(value) {
  return value.replace(/\r\n?/gu, "\n");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath, { normalizeText = false } = {}) {
  const bytes = await readFile(filePath);
  return sha256(normalizeText ? normalizeLf(bytes.toString("utf8")) : bytes);
}

export async function readJson(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new FrameworkError("MISSING_FILE", `Required file is missing: ${filePath}`);
    }
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new FrameworkError("INVALID_JSON", `Invalid JSON: ${filePath}`, { cause: error.message });
  }
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await atomicWrite(filePath, normalizeLf(value).replace(/\n*$/u, "\n"));
}

async function atomicWrite(filePath, value) {
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(value, "utf8");
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);
  } finally {
    if (handle) await handle.close();
    await rm(temporary, { force: true });
  }
}

export function now() {
  return new Date().toISOString();
}

export function slug(value, label = "identifier") {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value), "INVALID_IDENTIFIER", `${label} must use lowercase kebab-case.`);
  return value;
}

export function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

export function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}
