// Bundled skill catalog. Skills remain isolated resources so adding or
// disabling one does not require changing a provider driver. A future Skills
// UI can use the same manifests; today enabled built-ins are selected by their
// declared trigger terms and mounted capabilities.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
import { isSkillName, parseSkillMd, SKILL_FILE_MAX_BYTES } from "../shared/skill-md.js";
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function strings(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim())
        ? value.map((item) => item.trim())
        : null;
}
export function parseSkillManifest(value, directory) {
    if (!value || typeof value !== "object")
        throw new Error(`${directory}/manifest.json is invalid`);
    const raw = value;
    const id = typeof raw.id === "string" ? raw.id : "";
    const triggerTerms = strings(raw.triggerTerms);
    const requiredCapabilities = strings(raw.requiredCapabilities);
    if (!SAFE_ID.test(id) || id !== basename(directory))
        throw new Error(`${directory}/manifest.json has an invalid id`);
    if (typeof raw.name !== "string" || !raw.name.trim())
        throw new Error(`${directory}/manifest.json has no name`);
    if (typeof raw.version !== "string" || !/^\d+\.\d+\.\d+$/.test(raw.version))
        throw new Error(`${directory}/manifest.json has an invalid version`);
    if (typeof raw.description !== "string" || !raw.description.trim())
        throw new Error(`${directory}/manifest.json has no description`);
    if (typeof raw.defaultEnabled !== "boolean")
        throw new Error(`${directory}/manifest.json has no defaultEnabled flag`);
    if (!triggerTerms?.length)
        throw new Error(`${directory}/manifest.json has no trigger terms`);
    if (!requiredCapabilities)
        throw new Error(`${directory}/manifest.json has invalid capabilities`);
    return {
        id,
        name: raw.name.trim(),
        version: raw.version,
        description: raw.description.trim(),
        defaultEnabled: raw.defaultEnabled,
        triggerTerms,
        requiredCapabilities,
    };
}
function loadSkillDirectory(directory) {
    const manifestPath = join(directory, "manifest.json");
    const skillPath = join(directory, "SKILL.md");
    if (!existsSync(manifestPath) || !existsSync(skillPath))
        return null;
    const manifest = parseSkillManifest(JSON.parse(readFileSync(manifestPath, "utf8")), directory);
    const instructions = readFileSync(skillPath, "utf8").trim();
    if (!instructions.startsWith("---"))
        throw new Error(`${skillPath} has no skill frontmatter`);
    return { manifest, instructions, directory };
}
export function loadBundledSkills(root = process.env.OMB_SKILLS_DIR || join(process.cwd(), "skills")) {
    if (!existsSync(root))
        return [];
    const skills = [];
    for (const name of readdirSync(root).sort()) {
        const directory = join(root, name);
        const skill = loadSkillDirectory(directory);
        if (skill)
            skills.push(skill);
    }
    return skills;
}
/** User skills are hot-loaded on each turn so a skill that was just enabled
 * or hand-authored works without restarting the desktop app. One broken
 * folder is isolated instead of taking down every bot turn. */
export function loadUserSkills(root) {
    if (!existsSync(root))
        return [];
    let names;
    try {
        names = readdirSync(root).sort();
    }
    catch {
        return [];
    }
    const skills = [];
    for (const name of names) {
        try {
            const skill = loadSkillDirectory(join(root, name));
            if (skill)
                skills.push(skill);
        }
        catch {
            // Skills the app writes are validated first, but people are free to
            // hand-edit the folders later. A malformed edit disables only itself.
        }
    }
    return skills;
}
export function mergeSkills(bundled, user) {
    const byId = new Map(bundled.map((skill) => [skill.manifest.id, skill]));
    for (const skill of user) {
        if (!byId.has(skill.manifest.id))
            byId.set(skill.manifest.id, skill);
    }
    return [...byId.values()];
}
export function selectBundledSkills(text, capabilities, skills) {
    const haystack = text.toLowerCase();
    const available = new Set(capabilities);
    return skills.filter(({ manifest }) => manifest.defaultEnabled &&
        manifest.requiredCapabilities.every((capability) => available.has(capability)) &&
        manifest.triggerTerms.some((term) => haystack.includes(term.toLowerCase())));
}
export function renderSkillInstructions(selected, { includeRoot = false } = {}) {
    if (!selected.length)
        return "";
    return selected.map(({ manifest, instructions, directory }) => `\n\n<openmaus-skill id=${JSON.stringify(manifest.id)} version=${JSON.stringify(manifest.version)}${includeRoot ? ` root=${JSON.stringify(directory)}` : ""}>\n${instructions}\n</openmaus-skill>`).join("");
}
const skillLibraryEntrySchema = z.object({
    name: z.string(),
    description: z.string(),
    source: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    importedAt: z.string(),
    reviewState: z.enum(["approved", "disabled"]),
    license: z.string().optional(),
    compatibility: z.string().optional(),
    tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,23}$/)).max(8).optional(),
    warnings: z.array(z.string()),
    skippedFiles: z.array(z.string()),
    package: z.object({
        installId: z.string().regex(/^[a-f0-9]{32}$/),
        key: z.string().min(1).max(64),
        release: z.string().min(1).max(40),
        r: z.string().regex(/^[a-f0-9]{64}$/),
        w: z.string().regex(/^[a-f0-9]{64}$/),
        via: z.literal("preset").optional(),
    }).optional(),
});
const skillLibraryIndexSchema = z.record(z.string(), skillLibraryEntrySchema);
/** Every library write emits here so later skills-lane consumers can drop
 * caches without polling. The payload names what changed. */
export const skillLibraryEvents = new EventEmitter();
export function skillsLibraryRoot(dataDir = DATA_DIR) {
    return join(dataDir, "skills-library");
}
function libraryIndexPath(root) {
    return join(root, "index.json");
}
export function librarySkillDirectory(root, name) {
    return join(root, "skills", name);
}
/** The path agents are told to read for an assigned library skill. */
export function librarySkillFilePath(name, root = skillsLibraryRoot()) {
    return join(root, "skills", name, "SKILL.md");
}
/** Where a migrated per-bot copy is preserved. Archives are write-once:
 * migration never deletes the original bytes, it moves them here. */
export function libraryArchiveDirectory(root, botId, name) {
    return join(root, "archive", botId, name);
}
/** A missing index is a legitimate empty library; an index that exists but
 * cannot be read or validated is not, and writers must refuse rather than
 * replace it and strand every stored skill. */
function readSkillLibraryIndexState(root) {
    try {
        const parsed = JSON.parse(readFileSync(libraryIndexPath(root), "utf8"));
        const result = skillLibraryIndexSchema.safeParse(parsed);
        return result.success
            ? { index: result.data }
            : { error: "the skills library index is invalid" };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { index: {} };
        return { error: "the skills library index could not be read" };
    }
}
export function readSkillLibraryIndex(root = skillsLibraryRoot()) {
    const result = readSkillLibraryIndexState(root);
    return "error" in result ? {} : result.index;
}
function writeSkillLibraryIndex(root, index) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    writeFileAtomic(libraryIndexPath(root), `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
}
function sha256Hex(text) {
    return createHash("sha256").update(text).digest("hex");
}
function libraryContentMatches(root, entry) {
    try {
        const file = join(librarySkillDirectory(root, entry.name), "SKILL.md");
        if (!existsSync(file))
            return false;
        return sha256Hex(readFileSync(file, "utf8")) === entry.sha256;
    }
    catch {
        return false;
    }
}
function librarySkillListing(root, entry) {
    const intact = libraryContentMatches(root, entry);
    return {
        name: entry.name,
        description: entry.description,
        enabled: entry.reviewState === "approved" && intact,
        editable: false,
        source: entry.source,
        sha256: entry.sha256,
        importedAt: entry.importedAt,
        ...(entry.license ? { license: entry.license } : {}),
        ...(entry.compatibility ? { compatibility: entry.compatibility } : {}),
        tags: entry.tags ?? [],
        warnings: intact
            ? entry.warnings
            : [...entry.warnings, "stored SKILL.md changed after review — enablement is blocked"],
        skippedFiles: entry.skippedFiles,
    };
}
export function listLibrarySkills(root = skillsLibraryRoot()) {
    return Object.values(readSkillLibraryIndex(root))
        .map((entry) => librarySkillListing(root, entry))
        .sort((a, b) => a.name.localeCompare(b.name));
}
/** Put a skill in the library. Installing the same name with the same
 * SKILL.md bytes is idempotent (the existing entry wins); the same name
 * with different bytes is refused, mirroring the per-bot import rule.
 * Every failure returns `{ error }` — callers fall back. */
export function installLibrarySkill(input) {
    const root = input.root ?? skillsLibraryRoot();
    if (!isSkillName(input.name))
        return { error: "invalid skill name" };
    if (Buffer.byteLength(input.instructions, "utf8") > SKILL_FILE_MAX_BYTES) {
        return { error: `SKILL.md is larger than ${SKILL_FILE_MAX_BYTES / 1024}KB` };
    }
    const parsed = parseSkillMd(input.instructions);
    if ("error" in parsed)
        return parsed;
    if (parsed.name !== input.name)
        return { error: `the skill is named "${parsed.name}", not "${input.name}"` };
    const sha256 = sha256Hex(input.instructions);
    const indexRead = readSkillLibraryIndexState(root);
    if ("error" in indexRead)
        return indexRead;
    const index = indexRead.index;
    const existing = index[input.name];
    if (existing) {
        if (existing.sha256 === sha256)
            return librarySkillListing(root, existing);
        return { error: `a skill named "${input.name}" is already in the library — choose a different name` };
    }
    // Callers such as the library migration do not pass tags; frontmatter
    // tags parsed from the instructions are the source of record then.
    const tags = input.tags?.length ? input.tags : parsed.tags;
    const entry = {
        name: input.name,
        description: input.description?.trim() || parsed.description,
        source: input.source,
        sha256,
        importedAt: new Date().toISOString(),
        reviewState: input.reviewState ?? "disabled",
        ...(input.license ? { license: input.license } : {}),
        ...(input.compatibility ? { compatibility: input.compatibility } : {}),
        ...(tags?.length ? { tags } : {}),
        warnings: input.warnings ?? [],
        skippedFiles: [],
        ...(input.package ? { package: { ...input.package } } : {}),
    };
    // Bytes first, index second: the index is the commit point, so a crash
    // between the two leaves unreferenced bytes, never a dangling entry.
    mkdirSync(librarySkillDirectory(root, input.name), { recursive: true, mode: 0o700 });
    writeFileAtomic(join(librarySkillDirectory(root, input.name), "SKILL.md"), input.instructions, { mode: 0o600 });
    index[input.name] = entry;
    writeSkillLibraryIndex(root, index);
    skillLibraryEvents.emit("invalidate", { kind: "install", name: input.name });
    return librarySkillListing(root, entry);
}
export function readLibrarySkillFile(name, root = skillsLibraryRoot()) {
    if (!isSkillName(name))
        return null;
    const entry = readSkillLibraryIndex(root)[name];
    if (!entry)
        return null;
    try {
        const text = readFileSync(join(librarySkillDirectory(root, name), "SKILL.md"), "utf8");
        return sha256Hex(text) === entry.sha256 ? text : null;
    }
    catch {
        return null;
    }
}
export function setLibrarySkillReviewState(name, reviewState, root = skillsLibraryRoot()) {
    if (!isSkillName(name))
        return { error: "invalid skill name" };
    const index = readSkillLibraryIndex(root);
    const entry = index[name];
    if (!entry)
        return { error: `no library skill named "${name}"` };
    if (reviewState === "approved" && !libraryContentMatches(root, entry)) {
        return { error: "stored SKILL.md changed after review — the library entry cannot be approved" };
    }
    entry.reviewState = reviewState;
    writeSkillLibraryIndex(root, index);
    skillLibraryEvents.emit("invalidate", { kind: "review-state", name });
    return librarySkillListing(root, entry);
}
