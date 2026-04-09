export interface RawHierarchyNode {
  sectorCode: string;
  sectorName: string;
  rayonCode?: string;
  rayonName?: string;
  familleCode?: string;
  familleName?: string;
  sousFamilleCode?: string;
  sousFamilleName?: string;
  level: 1 | 2 | 3 | 4;
  fullPath: string;
}

function getIndentLevel(line: string): number {
  const tabCount = line.match(/^\t*/)?.[0]?.length ?? 0;
  const afterTabs = line.slice(tabCount);
  const hasExtraSpaces = /^\s{2,}/.test(afterTabs);
  return tabCount + (hasExtraSpaces ? 1 : 0);
}

export function parseHierarchy(rawText: string): RawHierarchyNode[] {
  const nodes: RawHierarchyNode[] = [];
  const lines = rawText.split('\n');

  let currentSector = { code: '', name: '' };
  let currentRayon = { code: '', name: '' };
  let currentFamille = { code: '', name: '' };

  for (const line of lines) {
    const level = getIndentLevel(line);
    const trimmed = line.trim();

    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const [, code, name] = match;
    const cleanName = name.trim();

    if (level === 0) {
      continue;
    } else if (level === 1) {
      currentSector = { code, name: cleanName };
      nodes.push({
        sectorCode: code,
        sectorName: cleanName,
        level: 1,
        fullPath: cleanName,
      });
    } else if (level === 2) {
      currentRayon = { code, name: cleanName };
      nodes.push({
        sectorCode: currentSector.code,
        sectorName: currentSector.name,
        rayonCode: code,
        rayonName: cleanName,
        level: 2,
        fullPath: `${currentSector.name} > ${cleanName}`,
      });
    } else if (level === 3) {
      currentFamille = { code, name: cleanName };
      nodes.push({
        sectorCode: currentSector.code,
        sectorName: currentSector.name,
        rayonCode: currentRayon.code,
        rayonName: currentRayon.name,
        familleCode: code,
        familleName: cleanName,
        level: 3,
        fullPath: `${currentSector.name} > ${currentRayon.name} > ${cleanName}`,
      });
    } else if (level >= 4) {
      nodes.push({
        sectorCode: currentSector.code,
        sectorName: currentSector.name,
        rayonCode: currentRayon.code,
        rayonName: currentRayon.name,
        familleCode: currentFamille.code,
        familleName: currentFamille.name,
        sousFamilleCode: code,
        sousFamilleName: cleanName,
        level: 4,
        fullPath: `${currentSector.name} > ${currentRayon.name} > ${currentFamille.name} > ${cleanName}`,
      });
    }
  }

  return nodes;
}
