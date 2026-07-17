import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, "public", "icons", "icon-map.json");

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

const run = async () => {
  const raw = await fs.readFile(MAP_PATH, "utf8");
  const map = JSON.parse(raw);
  const icons = map?.icons ?? {};

  let renamed = 0;
  let updated = 0;

  for (const [idStr, entry] of Object.entries(icons)) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || !entry || !entry.file || !entry.name) continue;

    const currentRel = String(entry.file).replace(/^\//, "");
    const currentAbs = path.join(ROOT, "public", currentRel);

    let ext = path.extname(currentRel);
    if (!ext) ext = ".png";

    const base = sanitizeFileBase(String(entry.name)) || String(id);
    const nextFileName = `${id}_${base}${ext}`;
    const nextRel = path.posix.join(path.posix.dirname(entry.file), nextFileName);
    const nextAbs = path.join(ROOT, "public", nextRel.replace(/^\//, ""));

    if (entry.file === nextRel || entry.file === `/${nextRel}`) continue;

    try {
      await fs.access(currentAbs);
      try {
        await fs.access(nextAbs);
      } catch {
        await fs.rename(currentAbs, nextAbs);
        renamed += 1;
      }
      entry.file = `/${nextRel.replace(/^\/+/, "")}`;
      updated += 1;
    } catch {
      // Skip missing files.
    }
  }

  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Updated map entries: ${updated}, Renamed files: ${renamed}`);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
