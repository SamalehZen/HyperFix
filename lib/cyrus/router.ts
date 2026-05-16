import { generateObject } from 'ai';
import { z } from 'zod';
import { hyper } from '@/ai/providers';
import type { CandidateNode, RoutingDecision } from '@/lib/cyrus/types';
import {
  ROUTER_HIGH_CONFIDENCE,
  ROUTER_MEDIUM_CONFIDENCE,
} from '@/lib/cyrus/constants';
import { getSectorSummaries } from '@/lib/cyrus/taxonomy';
import { buildRouterPrompt } from '@/ai/prompts/cyrus-router';

const RouterOutputSchema = z.object({
  results: z.array(
    z.object({
      label: z.string(),
      topSectorCode: z.string(),
      confidence: z.number().min(0).max(1),
      alternatives: z
        .array(
          z.object({
            sectorCode: z.string(),
            confidence: z.number(),
          }),
        )
        .optional(),
      reason: z.string(),
    }),
  ),
});

function tryPreRoute(
  label: string,
  candidates: CandidateNode[],
): RoutingDecision | null {
  if (candidates.length === 0) return null;

  const sectorScores = new Map<string, number>();
  for (const c of candidates) {
    if (!c.sectorCode) continue;
    const current = sectorScores.get(c.sectorCode) ?? 0;
    sectorScores.set(c.sectorCode, current + c.score);
  }

  if (sectorScores.size === 0) return null;

  const sorted = [...sectorScores.entries()].sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1];
  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);

  if (totalScore === 0) return null;

  const dominance = topScore / totalScore;

  if (dominance >= 0.8 && candidates[0].score >= 0.5) {
    return {
      topSectorCode: sorted[0][0],
      confidence: Math.min(dominance, 0.99),
      alternatives: sorted.slice(1, 3).map(([code, s]) => ({
        sectorCode: code,
        confidence: s / totalScore,
      })),
      reason: `pre-routed: retrieval dominant sector ${sorted[0][0]} (${(dominance * 100).toFixed(0)}%)`,
    };
  }

  return null;
}

export async function routeLabels(
  labels: string[],
  candidates: Map<string, CandidateNode[]>,
): Promise<Map<string, RoutingDecision>> {
  const results = new Map<string, RoutingDecision>();
  const needsLLM: string[] = [];

  for (const label of labels) {
    const labelCandidates = candidates.get(label) ?? [];
    const preRouted = tryPreRoute(label, labelCandidates);

    if (preRouted) {
      results.set(label, preRouted);
    } else {
      needsLLM.push(label);
    }
  }

  if (needsLLM.length > 0) {
    const sectorSummaries = getSectorSummaries();
    const prompt = buildRouterPrompt(sectorSummaries, needsLLM);

    try {
      const { object } = await generateObject({
        model: hyper.languageModel('hyper-default'),
        schema: RouterOutputSchema,
        prompt,
      });

      for (const result of object.results) {
        const matchLabel = needsLLM.find(
          (l) =>
            l === result.label ||
            l.toUpperCase() === result.label.toUpperCase(),
        );
        if (!matchLabel) continue;

        const decision: RoutingDecision = {
          topSectorCode: result.topSectorCode,
          confidence: result.confidence,
          alternatives: result.alternatives ?? [],
          reason: result.reason,
        };

        if (decision.confidence < ROUTER_MEDIUM_CONFIDENCE) {
          const alts = decision.alternatives ?? [];
          if (alts.length < 2) {
            const sectorCodes = sectorSummaries.map((s) => s.code);
            for (const code of sectorCodes) {
              if (
                code !== decision.topSectorCode &&
                !alts.some((a) => a.sectorCode === code)
              ) {
                alts.push({ sectorCode: code, confidence: 0.1 });
                if (alts.length >= 2) break;
              }
            }
            decision.alternatives = alts;
          }
        }

        results.set(matchLabel, decision);
      }
    } catch (error) {
      console.error('[Cyrus V2] Router LLM call failed:', error);
      for (const label of needsLLM) {
        if (!results.has(label)) {
          results.set(label, {
            topSectorCode: '03',
            confidence: 0.1,
            alternatives: [
              { sectorCode: '01', confidence: 0.1 },
              { sectorCode: '05', confidence: 0.1 },
            ],
            reason: 'router_fallback_error',
          });
        }
      }
    }
  }

  console.log(
    `[Cyrus V2] Routing complete: ${results.size} labels routed (${results.size - needsLLM.length} pre-routed, ${needsLLM.length} via LLM)`,
  );

  return results;
}

export function getSectorsForLabel(
  decision: RoutingDecision,
): string[] {
  const sectors: string[] = [decision.topSectorCode];

  if (decision.confidence < ROUTER_HIGH_CONFIDENCE) {
    const alts = decision.alternatives ?? [];
    const sorted = alts.sort((a, b) => b.confidence - a.confidence);

    if (decision.confidence >= ROUTER_MEDIUM_CONFIDENCE) {
      if (sorted.length > 0) {
        sectors.push(sorted[0].sectorCode);
      }
    } else {
      for (const alt of sorted.slice(0, 2)) {
        sectors.push(alt.sectorCode);
      }
    }
  }

  return [...new Set(sectors)];
}
