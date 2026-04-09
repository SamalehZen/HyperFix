import * as fs from "fs";
import * as path from "path";
import type {
  MasterTaxonomy,
  SectorTaxonomy,
  TaxonomyLevel,
  TaxonomyNode,
} from "@/lib/cyrus/types";

let masterCache: MasterTaxonomy | null = null;
const sectorCache = new Map<string, SectorTaxonomy>();
let nodeByIdIndex: Map<string, TaxonomyNode> | null = null;
let childrenIndex: Map<string, TaxonomyNode[]> | null = null;

function dataPath(...segments: string[]): string {
  return path.join(process.cwd(), "data", "cyrus", ...segments);
}

function ensureIndexes(): void {
  if (nodeByIdIndex && childrenIndex) return;

  const master = loadMasterTaxonomy();
  nodeByIdIndex = new Map();
  childrenIndex = new Map();

  for (const node of master.nodes) {
    nodeByIdIndex.set(node.id, node);

    const parentKey = node.parentId ?? "__root__";
    const siblings = childrenIndex.get(parentKey);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenIndex.set(parentKey, [node]);
    }
  }
}

export function loadMasterTaxonomy(): MasterTaxonomy {
  if (masterCache) return masterCache;
  const raw = fs.readFileSync(dataPath("master-taxonomy.json"), "utf-8");
  masterCache = JSON.parse(raw) as MasterTaxonomy;
  return masterCache;
}

const SECTOR_FILE_MAP: Record<string, string> = {
  "01": "01-marche.json",
  "02": "02-frais-industriel.json",
  "03": "03-epicerie.json",
  "04": "04-liquides.json",
  "05": "05-dhp.json",
  "06": "06-textile.json",
  "07": "07-bazar.json",
  "08": "08-bazar-lourd.json",
};

export function loadSectorTaxonomy(sectorCode: string): SectorTaxonomy {
  const cached = sectorCache.get(sectorCode);
  if (cached) return cached;

  const filename = SECTOR_FILE_MAP[sectorCode];
  if (!filename) {
    throw new Error(`Unknown sector code: ${sectorCode}`);
  }

  const raw = fs.readFileSync(dataPath("sectors", filename), "utf-8");
  const data = JSON.parse(raw) as SectorTaxonomy;
  sectorCache.set(sectorCode, data);
  return data;
}

export function findNodeById(nodeId: string): TaxonomyNode | undefined {
  ensureIndexes();
  return nodeByIdIndex!.get(nodeId);
}

export function findNodeByCode(
  code: string,
  level: TaxonomyLevel
): TaxonomyNode[] {
  const master = loadMasterTaxonomy();
  return master.nodes.filter((n) => n.code === code && n.level === level);
}

export function getChildren(parentId: string): TaxonomyNode[] {
  ensureIndexes();
  return childrenIndex!.get(parentId) ?? [];
}

export function getFullPath(nodeId: string): TaxonomyNode[] {
  ensureIndexes();
  const result: TaxonomyNode[] = [];
  let current = nodeByIdIndex!.get(nodeId);

  while (current) {
    result.unshift(current);
    current = current.parentId
      ? nodeByIdIndex!.get(current.parentId)
      : undefined;
  }

  return result;
}

export function isValidPath(
  sectorCode: string,
  rayonCode: string,
  familleCode: string,
  sousFamilleCode: string
): boolean {
  ensureIndexes();

  const sectorId = `sector-${sectorCode}`;
  const sector = nodeByIdIndex!.get(sectorId);
  if (!sector) return false;

  const rayonId = `rayon-${rayonCode}`;
  const rayon = nodeByIdIndex!.get(rayonId);
  if (!rayon || rayon.parentId !== sectorId) return false;

  const familleId = `famille-${familleCode}-${rayonCode}`;
  const famille = nodeByIdIndex!.get(familleId);
  if (!famille || famille.parentId !== rayonId) return false;

  const sfId = `sf-${sousFamilleCode}-${familleCode}-${rayonCode}`;
  const sf = nodeByIdIndex!.get(sfId);
  if (!sf || sf.parentId !== familleId) return false;

  return true;
}

export function getSectorSummaries(): Array<{
  code: string;
  name: string;
  rayonCount: number;
  description: string;
}> {
  ensureIndexes();

  const master = loadMasterTaxonomy();
  const sectors = master.nodes.filter((n) => n.level === "sector");

  return sectors.map((sector) => {
    const rayons = getChildren(sector.id);
    const rayonNames = rayons.map((r) => r.name);
    const description = rayonNames.join(", ");

    return {
      code: sector.code,
      name: sector.name,
      rayonCount: rayons.length,
      description,
    };
  });
}
