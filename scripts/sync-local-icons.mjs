import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_ICONS_DIR = path.join(ROOT, "public", "icons");
const CATEGORY_DIRS = {
  buildings: "Buildings",
  parts: "Parts",
  equipment: "Equipment",
  other: "Other",
};

const SYBOZZ_SORTED_TYPE_BASE_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/sorted%20type";

const OVERRIDES_FILE = path.join(ROOT, "scripts", "icon-file-title-overrides.json");
const CONFIG_FILE = path.join(ROOT, "scripts", "icon-sync-config.json");
const MAP_OUTPUT_FILE = path.join(PUBLIC_ICONS_DIR, "icon-map.json");
const REPORT_OUTPUT_FILE = path.join(PUBLIC_ICONS_DIR, "missing-icons-report.json");
const DOWNLOAD_CONCURRENCY = 6;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const REQUEST_TIMEOUT_MS = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseLuaIdToNameMap = (content) => {
  const map = {};
  const regex = /\[(\d+)\]\s*=\s*"([^"]*)"/g;
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    const id = Number(match[1]);
    const name = match[2].trim();
    if (Number.isFinite(id)) {
      map[id] = name;
    }
  }
  return map;
};

const defaultConfig = {
  prefixIdInFileName: true,
  includeSortedTypeFiles: [
    "0-building.lua",
    "1-part.lua",
    "2-equipment.lua",
    "3-monochrome.lua",
    "4-material.lua",
    "5-custom.lua",
    "6-map_stamp.lua",
  ],
  categoryMap: {
    "0-building.lua": "buildings",
    "1-part.lua": "parts",
    "2-equipment.lua": "equipment",
    "3-monochrome.lua": "other",
    "4-material.lua": "other",
    "5-custom.lua": "other",
    "6-map_stamp.lua": "other",
  },
};

const sanitizeFileBase = (name) =>
  name
    .trim()
    .replace(/[\u2122\u00AE]/g, "")
    .replace(/[\u2018\u2019]/g, "")
    .replace(/[,]/g, "")
    .replace(/[\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildWikiTitleCandidates = (name, overrideTitle) => {
  if (overrideTitle) return [overrideTitle];
  const normalized = name.trim();
  const noMarks = normalized.replace(/[\u2122\u00AE]/g, "").replace(/[\u2018\u2019]/g, "");
  const compact = noMarks.replace(/[,]/g, "").replace(/\s+/g, " ").trim();
  const underscored = compact.replace(/\s+/g, "_");

  const titles = [
    `${normalized}.png`,
    `${noMarks}.png`,
    `${compact}.png`,
    `${underscored}.png`,
    `${normalized}.webp`,
    `${noMarks}.webp`,
    `${compact}.webp`,
    `${underscored}.webp`,
  ];

  return Array.from(new Set(titles.filter((v) => v && v.length > 4)));
};

const extensionFromContentType = (contentType) => {
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/gif")) return ".gif";
  return ".png";
};

const fetchWithRetries = async (url, retries = 2) => {
  let lastErr = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "satisfactory-local-icon-sync/1.0" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok && RETRYABLE_STATUS_CODES.has(res.status) && i < retries) {
        await sleep(250 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(150 * (i + 1));
    }
  }
  throw lastErr;
};

const fetchWikiImage = async (title) => {
  const url = `https://satisfactory.wiki.gg/wiki/Special:FilePath/${encodeURIComponent(title)}`;
  let res = null;
  try {
    res = await fetchWithRetries(url, 2);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) return null;

  const bytes = Buffer.from(await res.arrayBuffer());
  const finalUrl = new URL(res.url);
  const ext = path.extname(finalUrl.pathname).toLowerCase() || extensionFromContentType(contentType);

  return { bytes, ext, sourceUrl: res.url };
};

const ensureDirectories = async () => {
  await fs.mkdir(PUBLIC_ICONS_DIR, { recursive: true });
  await Promise.all(
    Object.values(CATEGORY_DIRS).map((dir) => fs.mkdir(path.join(PUBLIC_ICONS_DIR, dir), { recursive: true }))
  );
};

const readOverrides = async () => {
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeOverrides = async (overrides) => {
  const normalized = Object.fromEntries(
    Object.entries(overrides)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
  );
  await fs.writeFile(OVERRIDES_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
};

const readConfig = async () => {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultConfig;
    return {
      prefixIdInFileName: typeof parsed.prefixIdInFileName === "boolean"
        ? parsed.prefixIdInFileName
        : defaultConfig.prefixIdInFileName,
      includeSortedTypeFiles: Array.isArray(parsed.includeSortedTypeFiles) && parsed.includeSortedTypeFiles.length > 0
        ? parsed.includeSortedTypeFiles
        : defaultConfig.includeSortedTypeFiles,
      categoryMap: parsed.categoryMap && typeof parsed.categoryMap === "object"
        ? parsed.categoryMap
        : defaultConfig.categoryMap,
    };
  } catch {
    return defaultConfig;
  }
};

const categoryNameForSource = (sourceFileName, config) => {
  const fromConfig = config.categoryMap[sourceFileName];
  if (fromConfig === "buildings" || fromConfig === "parts" || fromConfig === "equipment") return fromConfig;
  return "other";
};

const runWithConcurrency = async (items, limit, worker) => {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      await worker(next);
    }
  });
  await Promise.all(workers);
};

const sync = async () => {
  await ensureDirectories();
  const [overrides, config] = await Promise.all([readOverrides(), readConfig()]);
  let overridesChanged = false;

  const sourceEntries = [];
  for (const sourceFileName of config.includeSortedTypeFiles) {
    const sourceUrl = `${SYBOZZ_SORTED_TYPE_BASE_URL}/${encodeURIComponent(sourceFileName)}`;
    const sourceText = await (await fetchWithRetries(sourceUrl)).text();
    const map = parseLuaIdToNameMap(sourceText);
    for (const [idStr, rawName] of Object.entries(map)) {
      const id = Number(idStr);
      if (!Number.isFinite(id)) continue;
      sourceEntries.push({
        id,
        rawName: (rawName || "").trim(),
        sourceFileName,
        category: categoryNameForSource(sourceFileName, config),
      });
    }
  }

  // Keep one canonical entry per id, preferring non-empty names.
  const byId = new Map();
  for (const entry of sourceEntries) {
    const current = byId.get(entry.id);
    if (!current || (!current.rawName && entry.rawName)) {
      byId.set(entry.id, entry);
    }
  }

  const iconEntries = Array.from(byId.values()).sort((a, b) => a.id - b.id);

  const iconMap = {};
  const missing = [];
  let processedCount = 0;

  await runWithConcurrency(iconEntries, DOWNLOAD_CONCURRENCY, async (entry) => {
    const { id, rawName, category, sourceFileName } = entry;
    try {
      if (!rawName) {
        missing.push({ id, name: rawName, reason: "empty-name", sourceFileName });
        return;
      }

      const categoryDir = CATEGORY_DIRS[category];
      const base = sanitizeFileBase(rawName) || String(id);
      const preferredBase = config.prefixIdInFileName ? `${id}_${base}` : base;
      const overrideTitle = typeof overrides[id] === "string" ? overrides[id] : "";

      const exts = [".png", ".webp", ".jpg", ".gif"];
      const preferredFiles = exts.map((ext) => path.join(PUBLIC_ICONS_DIR, categoryDir, `${preferredBase}${ext}`));
      for (const existingFile of preferredFiles) {
        try {
          await fs.access(existingFile);
          iconMap[id] = {
            id,
            name: rawName,
            category: categoryDir,
            file: `/icons/${categoryDir}/${path.basename(existingFile)}`,
            source: sourceFileName,
            sourceUrl: "local-existing",
          };
          return;
        } catch {
          // continue
        }
      }

      // If only a legacy file exists, migrate it to the ID-prefixed name so future syncs stay consistent.
      const legacyFiles = exts.map((ext) => ({
        legacyAbs: path.join(PUBLIC_ICONS_DIR, categoryDir, `${base}${ext}`),
        preferredAbs: path.join(PUBLIC_ICONS_DIR, categoryDir, `${preferredBase}${ext}`),
      }));
      for (const { legacyAbs, preferredAbs } of legacyFiles) {
        try {
          await fs.access(legacyAbs);

          let chosenAbs = legacyAbs;
          if (config.prefixIdInFileName) {
            try {
              await fs.access(preferredAbs);
              chosenAbs = preferredAbs;
            } catch {
              try {
                await fs.rename(legacyAbs, preferredAbs);
                chosenAbs = preferredAbs;
              } catch {
                chosenAbs = legacyAbs;
              }
            }
          }

          iconMap[id] = {
            id,
            name: rawName,
            category: categoryDir,
            file: `/icons/${categoryDir}/${path.basename(chosenAbs)}`,
            source: sourceFileName,
            sourceUrl: "local-existing",
          };
          return;
        } catch {
          // continue
        }
      }

      const candidates = buildWikiTitleCandidates(rawName, overrideTitle);
      let downloaded = null;
      let matchedTitle = "";
      for (const candidate of candidates) {
        downloaded = await fetchWikiImage(candidate);
        if (downloaded) {
          matchedTitle = candidate;
          break;
        }
      }

      if (!downloaded) {
        missing.push({ id, name: rawName, reason: "download-failed", sourceFileName, tried: candidates });
        return;
      }

      const fileName = `${preferredBase}${downloaded.ext}`;
      const absPath = path.join(PUBLIC_ICONS_DIR, categoryDir, fileName);
      await fs.writeFile(absPath, downloaded.bytes);

      iconMap[id] = {
        id,
        name: rawName,
        category: categoryDir,
        file: `/icons/${categoryDir}/${fileName}`,
        source: sourceFileName,
        sourceUrl: downloaded.sourceUrl,
      };

      if (matchedTitle && overrides[id] !== matchedTitle) {
        overrides[id] = matchedTitle;
        overridesChanged = true;
      }
    } finally {
      processedCount += 1;
      if (processedCount % 50 === 0 || processedCount === iconEntries.length) {
        // eslint-disable-next-line no-console
        console.log(`Processed ${processedCount}/${iconEntries.length} icons`);
      }
    }
  });

  const output = {
    source: "SyBozz Satisfactory-Icons",
    generatedAt: new Date().toISOString(),
    totalEntries: iconEntries.length,
    resolvedCount: Object.keys(iconMap).length,
    missingCount: missing.length,
    icons: iconMap,
  };

  if (overridesChanged) {
    await writeOverrides(overrides);
  }

  await fs.writeFile(MAP_OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await fs.writeFile(REPORT_OUTPUT_FILE, `${JSON.stringify({ generatedAt: output.generatedAt, missing }, null, 2)}\n`, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Done. Resolved: ${output.resolvedCount}, Missing: ${output.missingCount}`);
  // eslint-disable-next-line no-console
  console.log(`Map: ${path.relative(ROOT, MAP_OUTPUT_FILE)}`);
  // eslint-disable-next-line no-console
  console.log(`Report: ${path.relative(ROOT, REPORT_OUTPUT_FILE)}`);
};

sync().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
