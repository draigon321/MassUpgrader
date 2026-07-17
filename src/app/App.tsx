import { useEffect, useMemo, useState, useRef } from "react";
import {
  Upload,
  Download,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowUpDown,
  FileCode2,
  Zap,
  RefreshCw,
  Sun,
  Moon,
  Check,
  X,
} from "lucide-react";
import { ICON_WIKI_FILENAME_OVERRIDES } from "./imports/iconWikiOverrides";

// ─── Blueprint toolkit ────────────────────────────────────────────────────────

const BELT_VARIANTS = [
  { family: "belt", tier: 1, label: "Conveyor Belt Mk.1", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1.Build_ConveyorBeltMk1_C" },
  { family: "belt", tier: 2, label: "Conveyor Belt Mk.2", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk2/Build_ConveyorBeltMk2.Build_ConveyorBeltMk2_C" },
  { family: "belt", tier: 3, label: "Conveyor Belt Mk.3", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk3/Build_ConveyorBeltMk3.Build_ConveyorBeltMk3_C" },
  { family: "belt", tier: 4, label: "Conveyor Belt Mk.4", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk4/Build_ConveyorBeltMk4.Build_ConveyorBeltMk4_C" },
  { family: "belt", tier: 5, label: "Conveyor Belt Mk.5", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk5/Build_ConveyorBeltMk5.Build_ConveyorBeltMk5_C" },
  { family: "belt", tier: 6, label: "Conveyor Belt Mk.6", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk6/Build_ConveyorBeltMk6.Build_ConveyorBeltMk6_C" },
  { family: "lift", tier: 1, label: "Conveyor Lift Mk.1", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk1/Build_ConveyorLiftMk1.Build_ConveyorLiftMk1_C" },
  { family: "lift", tier: 2, label: "Conveyor Lift Mk.2", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk2/Build_ConveyorLiftMk2.Build_ConveyorLiftMk2_C" },
  { family: "lift", tier: 3, label: "Conveyor Lift Mk.3", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk3/Build_ConveyorLiftMk3.Build_ConveyorLiftMk3_C" },
  { family: "lift", tier: 4, label: "Conveyor Lift Mk.4", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk4/Build_ConveyorLiftMk4.Build_ConveyorLiftMk4_C" },
  { family: "lift", tier: 5, label: "Conveyor Lift Mk.5", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk5/Build_ConveyorLiftMk5.Build_ConveyorLiftMk5_C" },
  { family: "lift", tier: 6, label: "Conveyor Lift Mk.6", typePath: "/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk6/Build_ConveyorLiftMk6.Build_ConveyorLiftMk6_C" },
];

const CONVEYOR_VARIANT_BY_TYPE_PATH = new Map(BELT_VARIANTS.map((v) => [v.typePath, v]));
const CONVEYOR_RECIPE_BY_TYPE_PATH = new Map(
  BELT_VARIANTS.map((v) => [v.typePath, v.typePath.replace("/Build_", "/Recipe_").replace(".Build_", ".Recipe_")])
);
const CONVEYOR_TIER_OPTIONS = BELT_VARIANTS;

const getConveyorVariant = (typePath: string) => CONVEYOR_VARIANT_BY_TYPE_PATH.get(typePath) ?? null;
const getConveyorRecipePath = (variant: (typeof BELT_VARIANTS)[0] | null) =>
  variant ? (CONVEYOR_RECIPE_BY_TYPE_PATH.get(variant.typePath) ?? "") : "";
const isConveyorBlueprintObject = (obj: any) => Boolean(obj && getConveyorVariant(obj.typePath));
const getBlueprintStem = (fileName: string) => fileName.replace(/\.(sbp|sbpcfg)$/i, "");
const isSbpFile = (file: File) => file.name.toLowerCase().endsWith(".sbp");
const isSbpcfgFile = (file: File) => file.name.toLowerCase().endsWith(".sbpcfg");

const findCompanionConfigFile = (sbpFile: File, files: File[]) => {
  const stem = getBlueprintStem(sbpFile.name).toLowerCase();
  return files.find((f) => isSbpcfgFile(f) && getBlueprintStem(f.name).toLowerCase() === stem) ?? null;
};

const rewriteConveyorObject = (object: any, targetVariant: (typeof BELT_VARIANTS)[0]) => ({
  ...object,
  typePath: targetVariant.typePath,
  properties: {
    ...object.properties,
    ...(object.properties?.mBuiltWithRecipe
      ? { mBuiltWithRecipe: { ...object.properties.mBuiltWithRecipe, value: { ...object.properties.mBuiltWithRecipe.value, pathName: getConveyorRecipePath(targetVariant) } } }
      : {}),
  },
});

const updateBlueprintConveyorGroupTier = (blueprint: any, family: string, fromTier: number, targetTier: number) => {
  const targetVariant = CONVEYOR_TIER_OPTIONS.find((v) => v.family === family && v.tier === targetTier);
  if (!targetVariant) return blueprint;
  return {
    ...blueprint,
    objects: blueprint.objects.map((obj: any) => {
      const current = getConveyorVariant(obj.typePath);
      if (!current || current.family !== family || current.tier !== fromTier) return obj;
      return rewriteConveyorObject(obj, targetVariant);
    }),
  };
};

const groupEditableBlueprintObjects = (blueprint: any) => {
  const groups = new Map<string, any>();
  for (const [index, object] of blueprint.objects.entries()) {
    const variant = getConveyorVariant(object.typePath);
    if (!variant) continue;
    const key = `${variant.family}:${variant.tier}`;
    const current = groups.get(key) ?? { family: variant.family, tier: variant.tier, variant, count: 0, indices: [] };
    current.count += 1;
    current.indices.push(index);
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.family === b.family ? a.tier - b.tier : a.family.localeCompare(b.family)
  );
};

const countEditableBlueprintObjects = (blueprint: any) =>
  blueprint.objects.filter(isConveyorBlueprintObject).length;

const createDefaultBlueprintConfig = (description = "") => ({
  configVersion: 5, description,
  color: { r: 1, g: 1, b: 1, a: 1 },
  iconID: 0, referencedIconLibrary: "", iconLibraryType: "",
});

const normalizeBlueprintConfig = (config: any, descriptionFallback = "") => ({
  ...createDefaultBlueprintConfig(descriptionFallback),
  ...(config ?? {}),
  color: {
    ...createDefaultBlueprintConfig(descriptionFallback).color,
    ...(config?.color ?? {}),
  },
});

const clampColorComponent = (value: number) => Math.max(0, Math.min(1, value));
const parseColorComponent = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return clampColorComponent(parsed);
};
const toRgb255 = (value: number) => Math.max(0, Math.min(255, Math.round(clampColorComponent(value) * 255)));
const LOCAL_ICON_MAP_URL = "/icons/icon-map.json";
const SYBOZZ_ALL_ICONS_RAW_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/all-icons.lua";
const SYBOZZ_PART_EQUIPMENT_RAW_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/part-equipment.lua";
const SYBOZZ_BUILDINGS_RAW_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/sorted%20type/0-building.lua";
const SYBOZZ_PARTS_RAW_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/sorted%20type/1-part.lua";
const SYBOZZ_EQUIPMENT_RAW_URL = "https://raw.githubusercontent.com/SyBozz/Satisfactory-Icons/main/icons/sorted%20type/2-equipment.lua";
const ICON_ID_CUSTOM_LINKS_STORAGE_KEY = "sbp-editor-icon-id-custom-links";

type IconCategory = "all" | "buildings" | "parts" | "equipment" | "other";

const deriveWikiIconFilenameFromLibraryPath = (libraryPath?: string) => {
  if (!libraryPath) return "";
  const trimmed = libraryPath.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return "";

  const base = trimmed
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/^[Tt][Xx]_?/, "")
    .replace(/\s+/g, "_")
    .trim();

  if (!base) return "";
  return `${base}.png`;
};

const iconNameToWikiFilename = (iconName: string) => {
  const cleaned = iconName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/_+/g, "_");
  return cleaned ? `${cleaned}.png` : "";
};

const parseLuaIdToNameMap = (content: string) => {
  const map: Record<number, string> = {};
  const regex = /\[(\d+)\]\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const id = Number(match[1]);
    const name = match[2].trim();
    if (Number.isFinite(id) && name) {
      map[id] = name;
    }
  }
  return map;
};

const parseLuaNameToIdMap = (content: string) => {
  const map: Record<number, string> = {};
  const regex = /\["([^"]+)"\]\s*=\s*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    const id = Number(match[2]);
    if (Number.isFinite(id) && name) {
      map[id] = name;
    }
  }
  return map;
};

const readCustomIconLinks = (): Record<number, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ICON_ID_CUSTOM_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const map: Record<number, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key);
      if (Number.isFinite(id) && typeof value === "string" && value.trim()) {
        map[id] = value.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_BLUEPRINT = {
  name: "Smelter_MK3",
  objects: [
    ...Array(24).fill(null).map(() => ({ typePath: BELT_VARIANTS[3].typePath, properties: {} })),
    ...Array(8).fill(null).map(() => ({ typePath: BELT_VARIANTS[4].typePath, properties: {} })),
    ...Array(12).fill(null).map(() => ({ typePath: BELT_VARIANTS[2].typePath, properties: {} })),
    ...Array(6).fill(null).map(() => ({ typePath: BELT_VARIANTS[8].typePath, properties: {} })),
    ...Array(4).fill(null).map(() => ({ typePath: BELT_VARIANTS[10].typePath, properties: {} })),
    ...Array(16).fill(null).map(() => ({ typePath: "/Game/FactoryGame/Buildable/Factory/Smelter/Build_Smelter.Build_Smelter_C", properties: {} })),
  ],
  config: {
    configVersion: 5,
    description: "Efficient copper smelter array — 24 smelters, Mk.4 belts, Mk.5 output line.",
    color: { r: 1, g: 1, b: 1, a: 1 },
    iconID: 0,
    referencedIconLibrary: "",
    iconLibraryType: "",
  },
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const DARK = {
  pageBg: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,158,11,0.06) 0%, transparent 60%), #0c0d0f",
  navBg: "rgba(12,13,15,0.95)",
  dropBarBg: "rgba(14,16,19,0.97)",
  statsBarBg: "rgba(12,13,15,0.97)",
  card: "#141619",
  cardAlt: "#0f1013",
  fg: "#e4e0d8",
  fgMuted: "#7a7770",
  fgDim: "#3a3830",
  border: "rgba(245,158,11,0.14)",
  borderSubtle: "rgba(255,255,255,0.05)",
  borderAccent: "rgba(245,158,11,0.1)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.1)",
  amberBorder: "rgba(245,158,11,0.25)",
  amberBorderStrong: "rgba(245,158,11,0.45)",
  amberFg: "#0c0d0f",
  green: "#4ade80",
  greenBg: "rgba(34,197,94,0.1)",
  greenBorder: "rgba(34,197,94,0.2)",
  red: "#f87171",
  redBg: "rgba(239,68,68,0.07)",
  redBorder: "rgba(239,68,68,0.2)",
  beltIcon: "#60a5fa",
  beltIconBg: "rgba(59,130,246,0.08)",
  beltIconBorder: "rgba(59,130,246,0.2)",
  liftIcon: "#c084fc",
  liftIconBg: "rgba(168,85,247,0.08)",
  liftIconBorder: "rgba(168,85,247,0.2)",
  selectBg: "#141619",
  selectFg: "#f59e0b",
};

const LIGHT = {
  pageBg: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(180,90,10,0.06) 0%, transparent 60%), #f0ede8",
  navBg: "rgba(240,237,232,0.96)",
  dropBarBg: "rgba(245,242,237,0.98)",
  statsBarBg: "rgba(240,237,232,0.96)",
  card: "#faf8f5",
  cardAlt: "#f0ede6",
  fg: "#1c1a16",
  fgMuted: "#6b6460",
  fgDim: "#b0aa9e",
  border: "rgba(160,110,20,0.18)",
  borderSubtle: "rgba(0,0,0,0.07)",
  borderAccent: "rgba(160,110,20,0.14)",
  amber: "#b45309",
  amberBg: "rgba(180,83,9,0.09)",
  amberBorder: "rgba(180,83,9,0.28)",
  amberBorderStrong: "rgba(180,83,9,0.5)",
  amberFg: "#ffffff",
  green: "#15803d",
  greenBg: "rgba(21,128,61,0.1)",
  greenBorder: "rgba(21,128,61,0.28)",
  red: "#dc2626",
  redBg: "rgba(220,38,38,0.07)",
  redBorder: "rgba(220,38,38,0.22)",
  beltIcon: "#2563eb",
  beltIconBg: "rgba(37,99,235,0.08)",
  beltIconBorder: "rgba(37,99,235,0.22)",
  liftIcon: "#7c3aed",
  liftIconBg: "rgba(124,58,237,0.08)",
  liftIconBorder: "rgba(124,58,237,0.22)",
  selectBg: "#faf8f5",
  selectFg: "#b45309",
};

type Theme = typeof DARK;

// ─── Tier config — shape + label so color is never the sole signal ────────────

const TIER_META: Record<number, { symbol: string; darkBg: string; darkFg: string; darkBorder: string; lightBg: string; lightFg: string; lightBorder: string }> = {
  1: { symbol: "①", darkBg: "rgba(156,163,175,0.12)", darkFg: "#9ca3af", darkBorder: "rgba(156,163,175,0.3)", lightBg: "rgba(100,116,139,0.1)", lightFg: "#475569", lightBorder: "rgba(100,116,139,0.3)" },
  2: { symbol: "②", darkBg: "rgba(132,204,22,0.12)", darkFg: "#a3e635", darkBorder: "rgba(132,204,22,0.3)", lightBg: "rgba(77,124,15,0.1)", lightFg: "#3f6212", lightBorder: "rgba(77,124,15,0.3)" },
  3: { symbol: "③", darkBg: "rgba(34,197,94,0.12)", darkFg: "#4ade80", darkBorder: "rgba(34,197,94,0.3)", lightBg: "rgba(21,128,61,0.1)", lightFg: "#166534", lightBorder: "rgba(21,128,61,0.3)" },
  4: { symbol: "④", darkBg: "rgba(59,130,246,0.12)", darkFg: "#60a5fa", darkBorder: "rgba(59,130,246,0.3)", lightBg: "rgba(37,99,235,0.1)", lightFg: "#1d4ed8", lightBorder: "rgba(37,99,235,0.3)" },
  5: { symbol: "⑤", darkBg: "rgba(168,85,247,0.12)", darkFg: "#c084fc", darkBorder: "rgba(168,85,247,0.3)", lightBg: "rgba(124,58,237,0.1)", lightFg: "#6d28d9", lightBorder: "rgba(124,58,237,0.3)" },
  6: { symbol: "⑥", darkBg: "rgba(245,158,11,0.14)", darkFg: "#fbbf24", darkBorder: "rgba(245,158,11,0.35)", lightBg: "rgba(180,83,9,0.1)", lightFg: "#92400e", lightBorder: "rgba(180,83,9,0.35)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatReadout({ label, value, highlight, t }: { label: string; value: string | number; highlight?: boolean; t: Theme }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2.5 border-r last:border-r-0" style={{ borderColor: "rgba(245,158,11,0.08)" }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.14em", color: t.fgMuted }} className="uppercase">
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2rem", lineHeight: 1, color: highlight ? t.amber : t.fg }}>
        {value}
        {highlight && value !== "—" && Number(value) > 0 && (
          <span style={{ fontSize: "0.6rem", marginLeft: 4, color: t.amber }}>▲</span>
        )}
      </span>
    </div>
  );
}

function TierBadge({ tier, isDark }: { tier: number; isDark: boolean }) {
  const m = TIER_META[tier] ?? TIER_META[1];
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", fontWeight: 600,
      background: isDark ? m.darkBg : m.lightBg,
      color: isDark ? m.darkFg : m.lightFg,
      border: `1px solid ${isDark ? m.darkBorder : m.lightBorder}`,
      borderRadius: "3px", padding: "2px 7px", letterSpacing: "0.06em",
    }}>
      {m.symbol} MK.{tier}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const isDark = mode === "dark";
  const t = isDark ? DARK : LIGHT;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedConfigFile, setSelectedConfigFile] = useState<File | null>(null);
  const [workingBlueprint, setWorkingBlueprint] = useState<any>(null);
  const [sourceBlueprint, setSourceBlueprint] = useState<any>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [exportStemDraft, setExportStemDraft] = useState("");
  const [iconFileNameDraft, setIconFileNameDraft] = useState("");
  const [iconIdNameMap, setIconIdNameMap] = useState<Record<number, string>>({});
  const [iconIdCategoryMap, setIconIdCategoryMap] = useState<Record<number, Exclude<IconCategory, "all">>>({});
  const [iconIdLocalPathMap, setIconIdLocalPathMap] = useState<Record<number, string>>({});
  const [customIconFileNameById, setCustomIconFileNameById] = useState<Record<number, string>>(() => readCustomIconLinks());
  const [isLoadingIconMap, setIsLoadingIconMap] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconPickerSearch, setIconPickerSearch] = useState("");
  const [iconPickerCategory, setIconPickerCategory] = useState<IconCategory>("all");
  const [iconPickerLinkDraft, setIconPickerLinkDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("Select a `.sbp` file to begin.");
  const [errorMessage, setErrorMessage] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canParse = Boolean(selectedFile);
  const hasBlueprint = Boolean(workingBlueprint);
  const workingConfig = normalizeBlueprintConfig(workingBlueprint?.config, descriptionDraft);
  const previewColor = `rgba(${Math.round(clampColorComponent(workingConfig.color.r) * 255)}, ${Math.round(clampColorComponent(workingConfig.color.g) * 255)}, ${Math.round(clampColorComponent(workingConfig.color.b) * 255)}, ${clampColorComponent(workingConfig.color.a).toFixed(2)})`;

  const groupedObjects = useMemo(() => {
    if (!workingBlueprint) return [];
    return groupEditableBlueprintObjects(workingBlueprint);
  }, [workingBlueprint]);

  const beltCount = groupedObjects.filter((e) => e.family === "belt").reduce((s, e) => s + e.count, 0);
  const liftCount = groupedObjects.filter((e) => e.family === "lift").reduce((s, e) => s + e.count, 0);

  const changedCount = useMemo(() => {
    if (!workingBlueprint || !sourceBlueprint) return 0;
    return workingBlueprint.objects.filter(
      (obj: any, i: number) => sourceBlueprint.objects[i]?.typePath !== obj.typePath
    ).length;
  }, [sourceBlueprint, workingBlueprint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ICON_ID_CUSTOM_LINKS_STORAGE_KEY, JSON.stringify(customIconFileNameById));
  }, [customIconFileNameById]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    if (isIconPickerOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isIconPickerOpen]);

  const handleFileSelection = (files: File[]) => {
    const sbpFile = files.find(isSbpFile) ?? null;
    if (!sbpFile) {
      setSelectedFile(null);
      setSelectedConfigFile(null);
      setErrorMessage("Only `.sbp` files are supported.");
      return;
    }
    const sbpcfgFile = findCompanionConfigFile(sbpFile, files);
    setSelectedFile(sbpFile);
    setSelectedConfigFile(sbpcfgFile);
    setErrorMessage("");
    setStatusMessage(
      sbpcfgFile
        ? `Blueprint + companion config loaded (${sbpFile.name}, ${sbpcfgFile.name}). Ready to parse.`
        : "Blueprint file loaded. Companion `.sbpcfg` not provided; defaults will be used for metadata."
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    handleFileSelection(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const nextTarget = e.relatedTarget as Node | null;
    if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  };

  const handleParse = async () => {
    if (!canParse || !selectedFile) { setErrorMessage("Choose a `.sbp` blueprint file first."); return; }
    setIsParsing(true); setErrorMessage("");
    try {
      const [mainBuffer, parserModule] = await Promise.all([
        selectedFile.arrayBuffer(),
        import("@etothepii/satisfactory-file-parser"),
      ]);
      const { BlueprintConfig, BlueprintConfigWriter, Parser } = parserModule as any;
      let configBuffer: ArrayBufferLike;
      if (selectedConfigFile) {
        configBuffer = await selectedConfigFile.arrayBuffer();
      } else {
        const configWriter = new BlueprintConfigWriter();
        BlueprintConfig.Serialize(configWriter, createDefaultBlueprintConfig(descriptionDraft));
        configBuffer = configWriter.endWriting();
      }
      const parsed = Parser.ParseBlueprintFiles(getBlueprintStem(selectedFile.name), mainBuffer, configBuffer, { throwErrors: true });
      const normalizedParsed = {
        ...parsed,
        config: normalizeBlueprintConfig(parsed.config, descriptionDraft),
      };
      setSourceBlueprint(normalizedParsed); setWorkingBlueprint(normalizedParsed);
      setDescriptionDraft(normalizedParsed.config.description ?? "");
      setExportStemDraft(getBlueprintStem(selectedFile.name));
      setIconFileNameDraft(
        customIconFileNameById[normalizedParsed.config.iconID] ??
        ICON_WIKI_FILENAME_OVERRIDES[normalizedParsed.config.iconID] ??
        deriveWikiIconFilenameFromLibraryPath(normalizedParsed.config.referencedIconLibrary)
      );
      if (!isLoadingIconMap && Object.keys(iconIdNameMap).length === 0) {
        void loadIconIdMap();
      }
      setStatusMessage(
        `Loaded "${parsed.name}" — ${countEditableBlueprintObjects(parsed)} conveyor objects editable.`
        + (selectedConfigFile ? " Parsed metadata from companion `.sbpcfg`." : " Using default metadata (no companion `.sbpcfg`).")
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg); setStatusMessage("Parse failed.");
      setWorkingBlueprint(null); setSourceBlueprint(null);
    } finally { setIsParsing(false); }
  };

  const loadDemoData = () => {
    const normalizedDemo = {
      ...DEMO_BLUEPRINT,
      config: normalizeBlueprintConfig(DEMO_BLUEPRINT.config, DEMO_BLUEPRINT.config.description),
    };
    setWorkingBlueprint(normalizedDemo); setSourceBlueprint(normalizedDemo);
    setDescriptionDraft(normalizedDemo.config.description);
    setExportStemDraft(getBlueprintStem(`${normalizedDemo.name}.sbp`));
    setIconFileNameDraft(
      customIconFileNameById[normalizedDemo.config.iconID] ??
      ICON_WIKI_FILENAME_OVERRIDES[normalizedDemo.config.iconID] ??
      deriveWikiIconFilenameFromLibraryPath(normalizedDemo.config.referencedIconLibrary)
    );
    setSelectedFile(null); setSelectedConfigFile(null); setErrorMessage("");
    setStatusMessage(`Demo loaded: "${DEMO_BLUEPRINT.name}" — ${countEditableBlueprintObjects(DEMO_BLUEPRINT)} conveyor objects.`);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWorkingBlueprint((bp: any) => bp ? { ...bp, name: val } : bp);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescriptionDraft(val);
    setWorkingBlueprint((bp: any) => bp ? { ...bp, config: { ...bp.config, description: val } } : bp);
  };

  const handleExportStemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExportStemDraft(getBlueprintStem(e.target.value));
  };

  const handleIconIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(e.target.value);
    const iconID = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
    setWorkingBlueprint((bp: any) => bp ? { ...bp, config: { ...bp.config, iconID } } : bp);
    setIconFileNameDraft(customIconFileNameById[iconID] ?? ICON_WIKI_FILENAME_OVERRIDES[iconID] ?? "");
    setIconPickerLinkDraft(customIconFileNameById[iconID] ?? ICON_WIKI_FILENAME_OVERRIDES[iconID] ?? "");
    if (!isLoadingIconMap && Object.keys(iconIdNameMap).length === 0) {
      void loadIconIdMap();
    }
  };

  const handleIconLibraryChange = (field: "referencedIconLibrary" | "iconLibraryType", value: string) => {
    setWorkingBlueprint((bp: any) => bp ? { ...bp, config: { ...bp.config, [field]: value } } : bp);
    if (field === "referencedIconLibrary") {
      setIconFileNameDraft((current) => current || deriveWikiIconFilenameFromLibraryPath(value));
    }
  };

  const handleRgbColorChannelChange = (channel: "r" | "g" | "b", value: string) => {
    const parsed = Number(value);
    const rgb255 = Number.isFinite(parsed) ? Math.max(0, Math.min(255, Math.round(parsed))) : 0;
    const parsedValue = clampColorComponent(rgb255 / 255);
    setWorkingBlueprint((bp: any) => bp
      ? { ...bp, config: { ...bp.config, color: { ...bp.config.color, [channel]: parsedValue } } }
      : bp);
  };

  const handleAlphaChannelChange = (value: string) => {
    const parsedValue = parseColorComponent(value);
    setWorkingBlueprint((bp: any) => bp
      ? { ...bp, config: { ...bp.config, color: { ...bp.config.color, a: parsedValue } } }
      : bp);
  };

  const applyIconSelection = (iconID: number) => {
    setWorkingBlueprint((bp: any) => bp ? { ...bp, config: { ...bp.config, iconID } } : bp);
    const preferred = customIconFileNameById[iconID] ?? ICON_WIKI_FILENAME_OVERRIDES[iconID] ?? "";
    const suggested = iconIdNameMap[iconID] ? iconNameToWikiFilename(iconIdNameMap[iconID]) : "";
    const nextLink = preferred || suggested;
    setIconFileNameDraft(preferred);
    setIconPickerLinkDraft(nextLink);
    setIsIconPickerOpen(false);
  };

  const saveCustomIconLinkForCurrentId = () => {
    const iconID = workingConfig.iconID ?? 0;
    const trimmed = iconPickerLinkDraft.trim();
    setCustomIconFileNameById((prev) => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[iconID];
        return next;
      }
      return { ...prev, [iconID]: trimmed };
    });
    setIconFileNameDraft(trimmed);
  };

  const loadIconIdMap = async () => {
    if (isLoadingIconMap || Object.keys(iconIdNameMap).length > 0) return;
    setIsLoadingIconMap(true);
    try {
      const localRes = await fetch(LOCAL_ICON_MAP_URL, { cache: "no-store" });
      if (localRes.ok) {
        const localPayload = await localRes.json() as {
          icons?: Record<string, { id: number; name: string; category: string; file: string }>;
        };
        const icons = localPayload?.icons ?? {};
        const localNameMap: Record<number, string> = {};
        const localCategoryMap: Record<number, Exclude<IconCategory, "all">> = {};
        const localPathMap: Record<number, string> = {};

        for (const entry of Object.values(icons)) {
          const id = Number(entry.id);
          if (!Number.isFinite(id) || !entry?.name) continue;
          localNameMap[id] = entry.name;
          const rawCategory = (entry.category || "").toLowerCase();
          localCategoryMap[id] =
            rawCategory === "buildings" ? "buildings"
              : rawCategory === "parts" ? "parts"
                : rawCategory === "equipment" ? "equipment"
                  : "other";
          if (entry.file) {
            localPathMap[id] = entry.file;
          }
        }

        if (Object.keys(localNameMap).length > 0) {
          setIconIdNameMap(localNameMap);
          setIconIdCategoryMap(localCategoryMap);
          setIconIdLocalPathMap(localPathMap);
          return;
        }
      }

      const [allIconsRes, partEquipRes, buildingsRes, partsRes, equipmentRes] = await Promise.all([
        fetch(SYBOZZ_ALL_ICONS_RAW_URL),
        fetch(SYBOZZ_PART_EQUIPMENT_RAW_URL),
        fetch(SYBOZZ_BUILDINGS_RAW_URL),
        fetch(SYBOZZ_PARTS_RAW_URL),
        fetch(SYBOZZ_EQUIPMENT_RAW_URL),
      ]);
      if (!allIconsRes.ok) throw new Error(`all-icons.lua HTTP ${allIconsRes.status}`);
      if (!partEquipRes.ok) throw new Error(`part-equipment.lua HTTP ${partEquipRes.status}`);
      if (!buildingsRes.ok) throw new Error(`0-building.lua HTTP ${buildingsRes.status}`);
      if (!partsRes.ok) throw new Error(`1-part.lua HTTP ${partsRes.status}`);
      if (!equipmentRes.ok) throw new Error(`2-equipment.lua HTTP ${equipmentRes.status}`);

      const [allIconsText, partEquipText, buildingsText, partsText, equipmentText] = await Promise.all([
        allIconsRes.text(),
        partEquipRes.text(),
        buildingsRes.text(),
        partsRes.text(),
        equipmentRes.text(),
      ]);

      const allIconsMap = parseLuaIdToNameMap(allIconsText);
      const partEquipmentMap = parseLuaNameToIdMap(partEquipText);
      const buildingMap = parseLuaIdToNameMap(buildingsText);
      const partMap = parseLuaIdToNameMap(partsText);
      const equipmentMap = parseLuaIdToNameMap(equipmentText);

      const nextMap: Record<number, string> = { ...allIconsMap };
      for (const [idStr, name] of Object.entries(partEquipmentMap)) {
        const id = Number(idStr);
        if (Number.isFinite(id) && !nextMap[id]) {
          nextMap[id] = name;
        }
      }

      const nextCategoryMap: Record<number, Exclude<IconCategory, "all">> = {};
      for (const idStr of Object.keys(buildingMap)) {
        nextCategoryMap[Number(idStr)] = "buildings";
      }
      for (const idStr of Object.keys(partMap)) {
        nextCategoryMap[Number(idStr)] = "parts";
      }
      for (const idStr of Object.keys(equipmentMap)) {
        nextCategoryMap[Number(idStr)] = "equipment";
      }
      for (const idStr of Object.keys(nextMap)) {
        const id = Number(idStr);
        if (!nextCategoryMap[id]) {
          nextCategoryMap[id] = "other";
        }
      }

      if (Object.keys(nextMap).length === 0) {
        throw new Error("No icon entries found in SyBozz tables.");
      }
      setIconIdNameMap(nextMap);
      setIconIdCategoryMap(nextCategoryMap);
      setIconIdLocalPathMap({});
    } catch {
      // Keep the editor responsive even when network lookup fails.
    } finally {
      setIsLoadingIconMap(false);
    }
  };

  const handleTierChange = (family: string, currentTier: number, nextTierValue: string) => {
    const nextTier = Number(nextTierValue);
    setWorkingBlueprint((bp: any) => bp ? updateBlueprintConveyorGroupTier(bp, family, currentTier, nextTier) : bp);
  };

  const handleExport = async () => {
    if (!workingBlueprint) { setErrorMessage("Parse a blueprint before exporting."); return; }
    setIsExporting(true); setErrorMessage("");
    try {
      const parserModule = await import("@etothepii/satisfactory-file-parser");
      const { Parser } = parserModule as any;
      let mainHeader: any = null;
      const mainChunks: any[] = [];
      const { configFileBinary } = Parser.WriteBlueprintFiles(
        workingBlueprint,
        (h: any) => { mainHeader = h; },
        (c: any) => { mainChunks.push(c); }
      );
      if (!mainHeader) throw new Error("Parser did not produce a blueprint header.");
      const stem = exportStemDraft.trim()
        ? getBlueprintStem(exportStemDraft.trim())
        : selectedFile
          ? getBlueprintStem(selectedFile.name)
          : getBlueprintStem(`${workingBlueprint.name || "blueprint"}.sbp`);
      const sbpName = `${stem}.sbp`;
      const sbpcfgName = `${stem}.sbpcfg`;
      downloadBlob(new Blob([mainHeader, ...mainChunks], { type: "application/octet-stream" }), sbpName);
      downloadBlob(new Blob([configFileBinary], { type: "application/octet-stream" }), sbpcfgName);
      setStatusMessage(`Exported ${sbpName} + ${sbpcfgName} with ${changedCount} tier edits.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg); setStatusMessage("Export failed.");
    } finally { setIsExporting(false); }
  };

  const monoSm: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem" };
  const monoXs: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem" };
  const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.95rem", letterSpacing: "0.06em" };
  const mappedIconName = iconIdNameMap[workingConfig.iconID ?? -1] ?? "";
  const localIconPreviewUrl = iconIdLocalPathMap[workingConfig.iconID ?? -1] ?? "";
  const resolvedIconFileName =
    iconFileNameDraft.trim()
    || customIconFileNameById[workingConfig.iconID ?? -1]
    || ICON_WIKI_FILENAME_OVERRIDES[workingConfig.iconID ?? -1]
    || (mappedIconName ? iconNameToWikiFilename(mappedIconName) : "");
  const remoteIconPreviewUrl = resolvedIconFileName
    ? `https://satisfactory.wiki.gg/wiki/Special:FilePath/${encodeURIComponent(resolvedIconFileName)}`
    : "";
  const iconPreviewUrl = localIconPreviewUrl || remoteIconPreviewUrl;
  const iconPickerItems = useMemo(() => {
    const term = iconPickerSearch.trim().toLowerCase();
    return Object.entries(iconIdNameMap)
      .map(([idStr, name]) => {
        const id = Number(idStr);
        const category = iconIdCategoryMap[id] ?? "other";
        const fileName = customIconFileNameById[id] ?? ICON_WIKI_FILENAME_OVERRIDES[id] ?? "";
        const suggestedFileName = iconNameToWikiFilename(name);
        const previewFileName = fileName || suggestedFileName;
        const localFile = iconIdLocalPathMap[id] ?? "";
        return { id, name, category, fileName, suggestedFileName, previewFileName, localFile };
      })
      .filter((item) => iconPickerCategory === "all" || item.category === iconPickerCategory)
      .filter((item) => !term || item.name.toLowerCase().includes(term) || String(item.id).includes(term))
      .sort((a, b) => a.id - b.id);
  }, [iconIdNameMap, iconIdCategoryMap, customIconFileNameById, iconPickerCategory, iconPickerSearch]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: t.pageBg,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        paddingTop: "calc(3.25rem + 3.5rem)",
        paddingBottom: "5.5rem",
        color: t.fg,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ─── Sticky top nav ────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 border-b"
        style={{ height: "3.25rem", background: t.navBg, backdropFilter: "blur(12px)", borderColor: t.borderAccent }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded" style={{ background: t.amberBg, border: `1px solid ${t.amberBorder}` }}>
            <Zap size={13} color={t.amber} />
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.08em", color: t.fg }} className="uppercase">
            Mass Upgrader
          </span>
          <span style={{ ...monoSm, background: t.amberBg, color: t.amber, border: `1px solid ${t.amberBorder}`, borderRadius: "3px", padding: "2px 7px" }}>
            SBP EDITOR
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/etothepii4/satisfactory-file-parser"
            target="_blank" rel="noreferrer"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", color: t.fgMuted }}
            className="hover:opacity-80 transition-opacity hidden md:block"
          >
            etothepii4/satisfactory-file-parser ↗
          </a>

          {/* Dark / Light toggle */}
          <button
            type="button"
            onClick={() => setMode(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all"
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem",
              background: t.amberBg, color: t.amber,
              border: `1px solid ${t.amberBorder}`,
            }}
          >
            {isDark ? <Sun size={12} /> : <Moon size={12} />}
            <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      {/* ─── Sticky drop bar ───────────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 z-40 border-b"
        style={{ top: "3.25rem", height: "3.5rem", background: t.dropBarBg, backdropFilter: "blur(12px)", borderColor: t.borderAccent }}
      >
        <div
          className="max-w-5xl mx-auto h-full flex items-center gap-4 px-4 md:px-6 transition-all"
          style={{ background: isDragging ? t.amberBg : "transparent" }}
        >
          <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
            <input ref={fileInputRef} type="file" accept=".sbp,.sbpcfg" multiple onChange={handleInputChange} className="hidden" />
            <div
              className="flex items-center justify-center w-7 h-7 rounded shrink-0 transition-colors"
              style={{ background: isDragging ? t.amberBg : "transparent", border: `1px solid ${isDragging ? t.amberBorderStrong : t.amberBorder}` }}
            >
              <Upload size={12} color={t.amber} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", color: isDragging ? t.amber : selectedFile ? t.fg : t.fgMuted }} className="truncate transition-colors">
              {isDragging
                ? "Release to load blueprint files…"
                : selectedFile
                  ? `${selectedFile.name}${selectedConfigFile ? ` + ${selectedConfigFile.name}` : ""}`
                  : "Drop `.sbp` (optionally `.sbpcfg`) or click to browse"}
            </span>
          </label>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button" onClick={handleParse} disabled={!canParse || isParsing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.06em", fontSize: "0.82rem", background: canParse && !isParsing ? t.amber : t.amberBg, color: canParse && !isParsing ? t.amberFg : t.fgMuted }}
            >
              {isParsing ? <RefreshCw size={11} className="animate-spin" /> : <Layers size={11} />}
              {isParsing ? "Parsing…" : "Parse"}
            </button>

            <button
              type="button" onClick={handleExport} disabled={!hasBlueprint || isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.06em", fontSize: "0.82rem", background: "transparent", color: hasBlueprint ? t.fg : t.fgDim, border: `1px solid ${hasBlueprint ? t.amberBorder : t.borderSubtle}` }}
            >
              {isExporting ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
              {isExporting ? "Exporting…" : "Export"}
            </button>

            <button
              type="button" onClick={loadDemoData}
              className="px-3 py-1.5 rounded transition-all"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", background: "transparent", color: t.fgDim, border: `1px solid ${t.borderSubtle}` }}
            >
              demo
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main content ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 grid gap-4 flex-1 w-full">

        {/* Status / error */}
        {(statusMessage || errorMessage) && (
          errorMessage ? (
            <div className="flex items-start gap-2 rounded px-3 py-2.5" style={{ background: t.redBg, border: `1px solid ${t.redBorder}` }}>
              <AlertTriangle size={13} color={t.red} className="mt-0.5 shrink-0" />
              <p style={{ ...monoSm, color: t.red }}>{errorMessage}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} color={t.green} className="shrink-0" />
              <p style={{ ...monoSm, color: t.fgMuted }}>{statusMessage}</p>
            </div>
          )
        )}

        {/* ─── Editor ──────────────────────────────────────────────── */}
        {hasBlueprint ? (
          <>
            {/* Metadata */}
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.card }}>
              <div className="px-5 py-3 flex items-center gap-2 border-b" style={{ borderColor: t.borderAccent }}>
                <span style={{ ...monoSm, color: t.amber }}>01</span>
                <span style={{ ...condensed, color: t.fg }} className="uppercase">Blueprint Metadata</span>
                <span style={{ ...monoSm, color: t.fgMuted, marginLeft: "auto" }}>{workingBlueprint.name}</span>
              </div>
              <div className="p-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-4">
                  <div className="grid gap-1.5">
                    <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Blueprint Name</label>
                    <input
                      value={workingBlueprint.name ?? ""}
                      onChange={handleNameChange}
                      placeholder="Name..."
                      className="w-full rounded px-4 py-2 text-sm focus:outline-none transition-all"
                      style={{ fontFamily: "'JetBrains Mono', monospace", background: t.cardAlt, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                      onFocus={(e) => (e.target.style.borderColor = t.amberBorderStrong)}
                      onBlur={(e) => (e.target.style.borderColor = t.borderSubtle)}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Blueprint Description</label>
                    <textarea
                      rows={5}
                      value={descriptionDraft}
                      onChange={handleDescriptionChange}
                      placeholder="Description..."
                      className="w-full resize-y rounded px-4 py-3 text-sm focus:outline-none transition-all"
                      style={{ fontFamily: "'DM Sans', sans-serif", background: t.cardAlt, border: `1px solid ${t.borderSubtle}`, color: t.fg, minHeight: 120, caretColor: t.amber }}
                      onFocus={(e) => (e.target.style.borderColor = t.amberBorderStrong)}
                      onBlur={(e) => (e.target.style.borderColor = t.borderSubtle)}
                    />
                  </div>

                  <div className="grid gap-2 rounded p-3" style={{ background: t.cardAlt, border: `1px solid ${t.borderSubtle}` }}>
                    <div className="grid gap-1.5">
                      <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Directory / Filename Stem</label>
                      <input
                        value={exportStemDraft}
                        onChange={handleExportStemChange}
                        placeholder="Smelter"
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                        onFocus={(e) => (e.target.style.borderColor = t.amberBorderStrong)}
                        onBlur={(e) => (e.target.style.borderColor = t.borderSubtle)}
                      />
                    </div>
                    <p style={{ ...monoXs, color: t.fgMuted }}>Resolved pair: {`${exportStemDraft || "blueprint"}.sbp`} + {`${exportStemDraft || "blueprint"}.sbpcfg`}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-3 rounded p-3" style={{ background: t.cardAlt, border: `1px solid ${t.borderSubtle}` }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded flex items-center justify-center shrink-0"
                        style={{ border: `1px solid ${t.amberBorder}`, background: previewColor }}
                        title="Blueprint color preview"
                      >
                        {iconPreviewUrl ? (
                          <img
                            src={iconPreviewUrl}
                            alt="Blueprint icon preview"
                            className="w-9 h-9 object-contain"
                            onError={() => setIconFileNameDraft("")}
                          />
                        ) : (
                          <FileCode2 size={20} color={t.fg} />
                        )}
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Icon ID</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={workingConfig.iconID ?? 0}
                            onChange={handleIconIdChange}
                            className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                            style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIconPickerLinkDraft(customIconFileNameById[workingConfig.iconID ?? 0] ?? ICON_WIKI_FILENAME_OVERRIDES[workingConfig.iconID ?? 0] ?? "");
                              setIsIconPickerOpen(true);
                              if (!isLoadingIconMap && Object.keys(iconIdNameMap).length === 0) {
                                void loadIconIdMap();
                              }
                            }}
                            className="px-3 py-2 rounded"
                            style={{ ...monoXs, background: t.amberBg, color: t.amber, border: `1px solid ${t.amberBorder}`, whiteSpace: "nowrap" }}
                          >
                            Pick
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Icon Library Path</label>
                      <input
                        value={workingConfig.referencedIconLibrary ?? ""}
                        onChange={(e) => handleIconLibraryChange("referencedIconLibrary", e.target.value)}
                        placeholder="/Game/FactoryGame/..."
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Icon Library Type</label>
                      <input
                        value={workingConfig.iconLibraryType ?? ""}
                        onChange={(e) => handleIconLibraryChange("iconLibraryType", e.target.value)}
                        placeholder="Icon library type"
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Wiki Icon Filename (optional)</label>
                      <input
                        value={iconFileNameDraft}
                        onChange={(e) => setIconFileNameDraft(e.target.value)}
                        placeholder="Build_Gun_Upgrade.png"
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                      />
                      {mappedIconName && (
                        <p style={{ ...monoXs, color: t.fgMuted }}>
                          ID {workingConfig.iconID}: {mappedIconName}{" -> "}{iconNameToWikiFilename(mappedIconName)}
                        </p>
                      )}
                      {isLoadingIconMap && (
                        <p style={{ ...monoXs, color: t.fgDim }}>
                          Resolving icon ID from SyBozz tables...
                        </p>
                      )}
                      <p style={{ ...monoXs, color: t.fgDim }}>
                        This enables preview only. Icon ID to image mapping is not stored in blueprint files.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5 rounded p-3" style={{ background: t.cardAlt, border: `1px solid ${t.borderSubtle}` }}>
                    <label style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Blueprint Color (RGB 0-255, A 0-1)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        max={255}
                        step={1}
                        value={toRgb255(workingConfig.color.r)}
                        onChange={(e) => handleRgbColorChannelChange("r", e.target.value)}
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                        aria-label="Color R"
                      />
                      <input
                        type="number"
                        min={0}
                        max={255}
                        step={1}
                        value={toRgb255(workingConfig.color.g)}
                        onChange={(e) => handleRgbColorChannelChange("g", e.target.value)}
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                        aria-label="Color G"
                      />
                      <input
                        type="number"
                        min={0}
                        max={255}
                        step={1}
                        value={toRgb255(workingConfig.color.b)}
                        onChange={(e) => handleRgbColorChannelChange("b", e.target.value)}
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                        aria-label="Color B"
                      />
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={Number(clampColorComponent(workingConfig.color.a).toFixed(2))}
                        onChange={(e) => handleAlphaChannelChange(e.target.value)}
                        className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace", background: t.card, border: `1px solid ${t.borderSubtle}`, color: t.fg, caretColor: t.amber }}
                        aria-label="Color A"
                      />
                    </div>
                    <p style={{ ...monoXs, color: t.fgDim }}>
                      Icon preview needs the game icon atlas/assets; blueprint files only store icon metadata (ID/library), not image content.
                    </p>
                    <p style={{ ...monoXs, color: t.fgDim }}>
                      Game-side directory and build cost are not persisted in SBP/SBPCFG by this parser.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conveyor groups */}
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}`, background: t.card }}>
              <div className="px-5 py-3 flex items-center gap-3 border-b" style={{ borderColor: t.borderAccent }}>
                <span style={{ ...monoSm, color: t.amber }}>02</span>
                <span style={{ ...condensed, color: t.fg }} className="uppercase">Conveyor Groups</span>
                <span style={{ ...monoSm, color: t.fgMuted, marginLeft: "auto" }}>
                  {groupedObjects.length} group{groupedObjects.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-4 grid gap-2">
                {groupedObjects.length === 0 ? (
                  <div className="text-center py-10 rounded" style={{ border: `1px dashed ${t.borderSubtle}`, background: t.cardAlt }}>
                    <p style={{ color: t.fgDim }} className="text-sm">No conveyor objects found in this blueprint</p>
                  </div>
                ) : (
                  groupedObjects.map((group) => {
                    const isBelt = group.family === "belt";
                    const familyOptions = CONVEYOR_TIER_OPTIONS.filter((o) => o.family === group.family);
                    return (
                      <div
                        key={`${group.family}-${group.tier}`}
                        className="flex items-center gap-4 rounded px-4 py-3 transition-all"
                        style={{ background: t.cardAlt, border: `1px solid ${t.borderSubtle}` }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = t.amberBorder)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = t.borderSubtle)}
                      >
                        {/* Type icon — shape differs for belt vs lift, independent of color */}
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded shrink-0"
                          style={{ background: isBelt ? t.beltIconBg : t.liftIconBg, border: `1px solid ${isBelt ? t.beltIconBorder : t.liftIconBorder}` }}
                          title={isBelt ? "Conveyor Belt" : "Conveyor Lift"}
                        >
                          {isBelt
                            ? <Layers size={13} color={t.beltIcon} />
                            : <ArrowUpDown size={13} color={t.liftIcon} />}
                        </div>

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: t.fg }}>
                              {isBelt ? "Conveyor Belt" : "Conveyor Lift"}
                            </span>
                            <TierBadge tier={group.tier} isDark={isDark} />
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span style={{ ...monoSm, color: t.fgMuted }}>×</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.9rem", color: t.fg }}>{group.count}</span>
                            <span style={{ ...monoSm, color: t.fgMuted }}>&nbsp;objects</span>
                          </div>
                        </div>

                        <ChevronRight size={13} color={t.fgDim} className="shrink-0" />

                        {/* Tier selector */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <span style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.1em" }} className="uppercase">Target tier</span>
                          <select
                            value={group.tier}
                            onChange={(e) => handleTierChange(group.family, group.tier, e.target.value)}
                            className="rounded px-3 py-1.5 cursor-pointer focus:outline-none transition-all"
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", background: t.selectBg, border: `1px solid ${t.amberBorder}`, color: t.selectFg, minWidth: 170 }}
                            onFocus={(e) => (e.target.style.borderColor = t.amberBorderStrong)}
                            onBlur={(e) => (e.target.style.borderColor = t.amberBorder)}
                          >
                            {familyOptions.map((opt) => (
                              <option key={opt.typePath} value={opt.tier} style={{ background: t.selectBg, color: t.fg }}>
                                {TIER_META[opt.tier]?.symbol} {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {changedCount > 0 && (
                <div
                  className="mx-4 mb-4 flex items-center justify-between rounded px-4 py-2.5"
                  style={{ background: t.amberBg, border: `1px solid ${t.amberBorder}` }}
                >
                  <div className="flex items-center gap-2">
                    <Zap size={12} color={t.amber} />
                    <span style={{ ...monoSm, color: t.amber }}>
                      {changedCount} object{changedCount !== 1 ? "s" : ""} modified — ready to export
                    </span>
                  </div>
                  <button
                    type="button" onClick={handleExport} disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-1.5 rounded transition-all disabled:opacity-40"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.06em", fontSize: "0.85rem", background: t.amber, color: t.amberFg }}
                  >
                    {isExporting ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                    Export
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            className="rounded-lg p-8 flex items-center justify-center"
            style={{ border: `1px dashed ${t.borderAccent}`, background: isDark ? "rgba(20,22,25,0.5)" : "rgba(250,248,245,0.5)", minHeight: 140 }}
          >
            <div className="text-center grid gap-2">
              <div className="flex items-center justify-center gap-2" style={{ color: t.fgDim }}>
                <Layers size={16} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.06em" }} className="uppercase">
                  Editor — awaiting blueprint
                </span>
              </div>
              <p style={{ ...monoXs, color: t.fgDim }}>Parse a `.sbp` file or load the demo to begin editing</p>
            </div>
          </div>
        )}
      </main>

      {isIconPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }}>
          <div
            className="w-full max-w-6xl h-[86vh] overflow-hidden rounded-lg border grid md:grid-cols-[230px_1fr]"
            style={{ background: t.card, borderColor: t.borderAccent }}
          >
            <aside className="border-r flex flex-col" style={{ borderColor: t.borderSubtle, background: t.cardAlt }}>
              <div className="p-4 border-b" style={{ borderColor: t.borderSubtle }}>
                <p style={{ ...condensed, color: t.fg }} className="uppercase">Icon Picker</p>
                <p style={{ ...monoXs, color: t.fgMuted }}>Select icon for ID {workingConfig.iconID}</p>
              </div>

              <div className="p-3 grid gap-2 border-b" style={{ borderColor: t.borderSubtle }}>
                {([
                  ["all", "All"],
                  ["buildings", "Buildings"],
                  ["parts", "Parts"],
                  ["equipment", "Equipment"],
                  ["other", "Other"],
                ] as Array<[IconCategory, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIconPickerCategory(value)}
                    className="text-left px-3 py-2 rounded"
                    style={{
                      ...monoSm,
                      background: iconPickerCategory === value ? t.amberBg : "transparent",
                      color: iconPickerCategory === value ? t.amber : t.fgMuted,
                      border: `1px solid ${iconPickerCategory === value ? t.amberBorder : "transparent"}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 grid gap-2 mt-auto border-t" style={{ borderColor: t.borderSubtle }}>
                <button
                  type="button"
                  onClick={() => setIsIconPickerOpen(false)}
                  className="w-full py-2 rounded"
                  style={{ ...monoSm, background: "transparent", color: t.fgMuted, border: `1px solid ${t.borderSubtle}` }}
                >
                  Close
                </button>
              </div>
            </aside>

            <section className="flex flex-col min-h-0 overflow-hidden">
              <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: t.borderSubtle }}>
                <input
                  value={iconPickerSearch}
                  onChange={(e) => setIconPickerSearch(e.target.value)}
                  placeholder="Search icons by name or ID..."
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: t.cardAlt, border: `1px solid ${t.borderSubtle}`, color: t.fg }}
                />
                <button
                  type="button"
                  onClick={() => setIsIconPickerOpen(false)}
                  className="p-2 rounded"
                  style={{ border: `1px solid ${t.borderSubtle}`, color: t.fgMuted }}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-3 border-b grid md:grid-cols-[1fr_1fr] gap-2" style={{ borderColor: t.borderSubtle }}>
                <input
                  value={iconPickerLinkDraft}
                  onChange={(e) => setIconPickerLinkDraft(e.target.value)}
                  placeholder="Link current Icon ID to wiki filename (e.g. Conveyor_Splitter.png)"
                  className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: t.cardAlt, border: `1px solid ${t.borderSubtle}`, color: t.fg }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveCustomIconLinkForCurrentId}
                    className="px-3 py-2 rounded"
                    style={{ ...monoSm, background: t.amberBg, color: t.amber, border: `1px solid ${t.amberBorder}` }}
                  >
                    Save Link For ID {workingConfig.iconID}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconPickerLinkDraft("")}
                    className="px-3 py-2 rounded"
                    style={{ ...monoSm, background: "transparent", color: t.fgMuted, border: `1px solid ${t.borderSubtle}` }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                className="p-3 overflow-y-auto flex-1 min-h-0 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2"
                style={{ overscrollBehavior: "contain" }}
                onWheelCapture={(e) => e.stopPropagation()}
              >
                {iconPickerItems.map((icon) => {
                  const previewUrl = icon.localFile || (icon.previewFileName
                    ? `https://satisfactory.wiki.gg/wiki/Special:FilePath/${encodeURIComponent(icon.previewFileName)}`
                    : "");
                  const selected = icon.id === (workingConfig.iconID ?? -1);
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => applyIconSelection(icon.id)}
                      title={`${icon.id} - ${icon.name}`}
                      className="rounded p-1.5 grid gap-1 text-left"
                      style={{
                        background: selected ? t.amberBg : t.cardAlt,
                        border: `1px solid ${selected ? t.amberBorderStrong : t.borderSubtle}`,
                      }}
                    >
                      <div className="w-full aspect-square rounded relative flex items-center justify-center" style={{ background: t.card }}>
                        <FileCode2 size={18} color={t.fgDim} />
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt={icon.name}
                            className="w-10 h-10 object-contain absolute"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <span className="truncate" style={{ ...monoXs, color: selected ? t.amber : t.fgMuted }}>{icon.id}</span>
                      <span className="truncate" style={{ ...monoXs, color: t.fgDim }}>{icon.name}</span>
                      {!icon.fileName && (
                        <span className="truncate" style={{ ...monoXs, color: t.fgDim }}>
                          link needed: {icon.suggestedFileName}
                        </span>
                      )}
                    </button>
                  );
                })}
                {iconPickerItems.length === 0 && (
                  <div className="col-span-full py-10 text-center" style={{ ...monoSm, color: t.fgDim }}>
                    No icons match the current filter.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ─── Sticky bottom stats bar ───────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ background: t.statsBarBg, backdropFilter: "blur(12px)", borderColor: t.borderAccent }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="px-4 md:px-6 py-1.5 flex items-center gap-2 border-b" style={{ borderColor: isDark ? "rgba(245,158,11,0.07)" : "rgba(160,110,20,0.1)" }}>
            <Cpu size={10} color={t.amber} />
            <span style={{ ...monoXs, color: t.fgMuted, letterSpacing: "0.14em" }} className="uppercase">Blueprint status</span>
            {hasBlueprint && (
              <span
                className="flex items-center gap-1"
                style={{ ...monoXs, background: t.greenBg, color: t.green, border: `1px solid ${t.greenBorder}`, borderRadius: "3px", padding: "1px 6px" }}
              >
                <Check size={9} /> LOADED
              </span>
            )}
            <span style={{ ...monoXs, color: t.fgDim }} className="ml-auto hidden sm:block">
              Parsing powered by{" "}
              <a
                href="https://github.com/etothepii4/satisfactory-file-parser"
                target="_blank"
                rel="noreferrer"
                style={{ color: t.fgMuted, textDecoration: "underline", textUnderlineOffset: "2px" }}
              >
                etothepii4/satisfactory-file-parser
              </a>
            </span>
          </div>
          <div className="flex overflow-x-auto px-2 md:px-4" style={{ scrollbarWidth: "none" }}>
            <StatReadout label="File" value={workingBlueprint?.name ?? "—"} t={t} />
            <StatReadout label="Groups" value={groupedObjects.length} t={t} />
            <StatReadout label="Belts" value={beltCount} t={t} />
            <StatReadout label="Lifts" value={liftCount} t={t} />
            <StatReadout label="Objects" value={workingBlueprint?.objects.length ?? "—"} t={t} />
            <StatReadout label="Pending" value={changedCount} highlight={changedCount > 0} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
