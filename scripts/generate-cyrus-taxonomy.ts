import * as fs from "fs";
import * as path from "path";

interface TaxonomyNode {
  id: string;
  level: "sector" | "rayon" | "famille" | "sous-famille";
  code: string;
  name: string;
  parentId: string | null;
  aliases: string[];
}

interface MasterTaxonomy {
  version: string;
  storeName: string;
  storeCode: string;
  generatedAt: string;
  nodes: TaxonomyNode[];
}

interface SectorFile {
  sectorCode: string;
  sectorName: string;
  sectorId: string;
  nodes: TaxonomyNode[];
}

const LEVEL_NAMES: Record<number, TaxonomyNode["level"]> = {
  1: "sector",
  2: "rayon",
  3: "famille",
  4: "sous-famille",
};

function parseLine(line: string): { level: number; code: string; name: string } | null {
  if (!line.trim()) return null;

  let tabCount = 0;
  for (const ch of line) {
    if (ch === "\t") tabCount++;
    else break;
  }

  const afterTabs = line.slice(tabCount);
  const leadingSpaces = afterTabs.length - afterTabs.trimStart().length;
  const effectiveLevel = tabCount + (leadingSpaces >= 4 ? 1 : 0);

  const content = line.trim();
  const match = content.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  return {
    level: effectiveLevel,
    code: match[1],
    name: match[2].trim(),
  };
}

function buildId(
  level: TaxonomyNode["level"],
  code: string,
  parentContext: { rayonCode?: string; familleCode?: string }
): string {
  switch (level) {
    case "sector":
      return `sector-${code}`;
    case "rayon":
      return `rayon-${code}`;
    case "famille":
      return `famille-${code}-${parentContext.rayonCode}`;
    case "sous-famille":
      return `sf-${code}-${parentContext.familleCode}-${parentContext.rayonCode}`;
  }
}

function main() {
  const sourceFile = path.join(process.cwd(), "ai/prompts/classification-cyrus.ts");
  const content = fs.readFileSync(sourceFile, "utf-8");

  const match = content.match(/export const CLASSIFICATION_HIERARCHY = \\?`\n([\s\S]*?)\\?`/);
  if (!match) {
    console.error("ERROR: Could not find CLASSIFICATION_HIERARCHY in source file");
    process.exit(1);
  }

  const rawLines = match[1].split("\n");

  const nodes: TaxonomyNode[] = [];
  let storeName = "";
  let storeCode = "";

  let currentSectorCode = "";
  let currentRayonCode = "";
  let currentFamilleCode = "";

  for (const line of rawLines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { level, code, name } = parsed;

    if (level === 0) {
      storeCode = code;
      storeName = name;
      continue;
    }

    const taxonomyLevel = LEVEL_NAMES[level];
    if (!taxonomyLevel) continue;

    let parentId: string | null = null;
    let nodeId: string;

    switch (taxonomyLevel) {
      case "sector":
        currentSectorCode = code;
        nodeId = buildId("sector", code, {});
        parentId = null;
        break;
      case "rayon":
        currentRayonCode = code;
        nodeId = buildId("rayon", code, {});
        parentId = `sector-${currentSectorCode}`;
        break;
      case "famille":
        currentFamilleCode = code;
        nodeId = buildId("famille", code, { rayonCode: currentRayonCode });
        parentId = `rayon-${currentRayonCode}`;
        break;
      case "sous-famille":
        nodeId = buildId("sous-famille", code, {
          rayonCode: currentRayonCode,
          familleCode: currentFamilleCode,
        });
        parentId = `famille-${currentFamilleCode}-${currentRayonCode}`;
        break;
    }

    nodes.push({
      id: nodeId,
      level: taxonomyLevel,
      code,
      name,
      parentId,
      aliases: [],
    });
  }

  const master: MasterTaxonomy = {
    version: "1.0.0",
    storeName,
    storeCode,
    generatedAt: new Date().toISOString(),
    nodes,
  };

  const outDir = path.join(process.cwd(), "data/cyrus");
  const sectorsDir = path.join(outDir, "sectors");

  fs.mkdirSync(sectorsDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "master-taxonomy.json"), JSON.stringify(master, null, 2));

  const sectorNameMap: Record<string, string> = {
    "01": "marche",
    "02": "frais-industriel",
    "03": "epicerie",
    "04": "liquides",
    "05": "dhp",
    "06": "textile",
    "07": "bazar",
    "08": "bazar-lourd",
  };

  const sectorNodes = nodes.filter((n) => n.level === "sector");
  for (const sector of sectorNodes) {
    const sectorId = sector.id;
    const childNodes = nodes.filter((n) => {
      if (n.level === "sector") return false;
      if (n.level === "rayon") return n.parentId === sectorId;
      if (n.level === "famille") {
        const rayon = nodes.find((r) => r.id === n.parentId);
        return rayon?.parentId === sectorId;
      }
      if (n.level === "sous-famille") {
        const famille = nodes.find((f) => f.id === n.parentId);
        if (!famille) return false;
        const rayon = nodes.find((r) => r.id === famille.parentId);
        return rayon?.parentId === sectorId;
      }
      return false;
    });

    const sectorFile: SectorFile = {
      sectorCode: sector.code,
      sectorName: sector.name,
      sectorId: sector.id,
      nodes: childNodes,
    };

    const filename = `${sector.code}-${sectorNameMap[sector.code] || sector.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    fs.writeFileSync(path.join(sectorsDir, filename), JSON.stringify(sectorFile, null, 2));
  }

  const sectors = nodes.filter((n) => n.level === "sector");
  const rayons = nodes.filter((n) => n.level === "rayon");
  const familles = nodes.filter((n) => n.level === "famille");
  const sousFamilles = nodes.filter((n) => n.level === "sous-famille");

  console.log("\n=== Cyrus Taxonomy Generation Summary ===");
  console.log(`Store: ${storeCode} ${storeName}`);
  console.log(`Sectors:       ${sectors.length}`);
  console.log(`Rayons:        ${rayons.length}`);
  console.log(`Familles:      ${familles.length}`);
  console.log(`Sous-familles: ${sousFamilles.length}`);
  console.log(`Total nodes:   ${nodes.length}`);
  console.log("");

  for (const s of sectors) {
    const sRayons = rayons.filter((r) => r.parentId === s.id);
    const sRayonIds = new Set(sRayons.map((r) => r.id));
    const sFamilles = familles.filter((f) => sRayonIds.has(f.parentId!));
    const sFamilleIds = new Set(sFamilles.map((f) => f.id));
    const sSousFamilles = sousFamilles.filter((sf) => sFamilleIds.has(sf.parentId!));
    console.log(
      `  ${s.code} ${s.name.padEnd(20)} → ${sRayons.length} rayons, ${sFamilles.length} familles, ${sSousFamilles.length} sous-familles`
    );
  }

  console.log(`\nFiles written:`);
  console.log(`  data/cyrus/master-taxonomy.json`);
  for (const s of sectors) {
    const filename = `${s.code}-${sectorNameMap[s.code] || s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    console.log(`  data/cyrus/sectors/${filename}`);
  }
  console.log("");
}

main();
