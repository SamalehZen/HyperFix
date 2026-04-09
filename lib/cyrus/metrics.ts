import type { PipelineMetrics } from '@/lib/cyrus/types';
import {
  ROUTER_HIGH_CONFIDENCE,
  ROUTER_MEDIUM_CONFIDENCE,
} from '@/lib/cyrus/constants';

export interface DetailedMetrics extends PipelineMetrics {
  extractionMs: number;
  normalizationMs: number;
  cacheLookupMs: number;
  retrievalMs: number;
  routingMs: number;
  expertMs: number;
  validationMs: number;
  formattingMs: number;

  routingResults: {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  validationResults: {
    classified: number;
    needsReview: number;
    fallbackUsed: number;
  };
  expertCalls: number;
  sectorsUsed: string[];
  tokensEstimate: number;
}

export class PipelineTimer {
  private timers = new Map<string, number>();
  private durations = new Map<string, number>();

  start(step: string): void {
    this.timers.set(step, Date.now());
  }

  stop(step: string): number {
    const startTime = this.timers.get(step);
    if (startTime === undefined) return 0;
    const duration = Date.now() - startTime;
    this.durations.set(step, duration);
    this.timers.delete(step);
    return duration;
  }

  getAll(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.durations) {
      result[key] = value;
    }
    return result;
  }
}

export class MetricsCollector {
  private timer = new PipelineTimer();
  private counters: Partial<DetailedMetrics> = {
    routingResults: { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 },
    validationResults: { classified: 0, needsReview: 0, fallbackUsed: 0 },
    expertCalls: 0,
    sectorsUsed: [],
    tokensEstimate: 0,
  };
  private currentStep = '';

  startStep(step: string): void {
    this.currentStep = step;
    this.timer.start(step);
  }

  endStep(step: string): void {
    this.timer.stop(step);
    if (this.currentStep === step) {
      this.currentStep = '';
    }
  }

  getCurrentStep(): string {
    return this.currentStep;
  }

  increment(key: string, value: number = 1): void {
    const current = (this.counters as any)[key];
    if (typeof current === 'number') {
      (this.counters as any)[key] = current + value;
    }
  }

  incrementRouting(confidence: number): void {
    const r = this.counters.routingResults!;
    if (confidence > ROUTER_HIGH_CONFIDENCE) {
      r.highConfidence++;
    } else if (confidence >= ROUTER_MEDIUM_CONFIDENCE) {
      r.mediumConfidence++;
    } else {
      r.lowConfidence++;
    }
  }

  incrementValidation(
    status: 'classified' | 'needs_review' | 'fallback_used',
  ): void {
    const v = this.counters.validationResults!;
    switch (status) {
      case 'classified':
        v.classified++;
        break;
      case 'needs_review':
        v.needsReview++;
        break;
      case 'fallback_used':
        v.fallbackUsed++;
        break;
    }
  }

  addSector(code: string): void {
    const sectors = this.counters.sectorsUsed!;
    if (!sectors.includes(code)) {
      sectors.push(code);
    }
  }

  addTokens(count: number): void {
    this.counters.tokensEstimate =
      (this.counters.tokensEstimate ?? 0) + count;
  }

  finalize(): DetailedMetrics {
    const durations = this.timer.getAll();
    return {
      totalInput: (this.counters.totalInput as number) ?? 0,
      uniqueLabels: (this.counters.uniqueLabels as number) ?? 0,
      cacheHits: (this.counters.cacheHits as number) ?? 0,
      cacheMisses: (this.counters.cacheMisses as number) ?? 0,
      durationMs: (this.counters.durationMs as number) ?? 0,
      mode: (this.counters.mode as 'simple' | 'bulk') ?? 'bulk',

      extractionMs: durations['extraction'] ?? 0,
      normalizationMs: durations['normalization'] ?? 0,
      cacheLookupMs: durations['cacheLookup'] ?? 0,
      retrievalMs: durations['retrieval'] ?? 0,
      routingMs: durations['routing'] ?? 0,
      expertMs: durations['expert'] ?? 0,
      validationMs: durations['validation'] ?? 0,
      formattingMs: durations['formatting'] ?? 0,

      routingResults: this.counters.routingResults ?? {
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
      },
      validationResults: this.counters.validationResults ?? {
        classified: 0,
        needsReview: 0,
        fallbackUsed: 0,
      },
      expertCalls: this.counters.expertCalls ?? 0,
      sectorsUsed: this.counters.sectorsUsed ?? [],
      tokensEstimate: this.counters.tokensEstimate ?? 0,
    };
  }

  setBase(base: Partial<PipelineMetrics>): void {
    Object.assign(this.counters, base);
  }

  logSummary(): void {
    const m = this.finalize();
    const durations = this.timer.getAll();
    const durationSec = (m.durationMs / 1000).toFixed(1);
    const cacheRate =
      m.uniqueLabels > 0
        ? ((m.cacheHits / m.uniqueLabels) * 100).toFixed(1)
        : '0.0';
    const totalRouted =
      m.routingResults.highConfidence +
      m.routingResults.mediumConfidence +
      m.routingResults.lowConfidence;

    const stepDurations = [
      `extract:${m.extractionMs}ms`,
      `normalize:${m.normalizationMs}ms`,
      `cache:${m.cacheLookupMs}ms`,
      `retrieval:${m.retrievalMs}ms`,
      `routing:${m.routingMs}ms`,
      `expert:${m.expertMs}ms`,
      `validation:${m.validationMs}ms`,
      `format:${m.formattingMs}ms`,
    ].join(', ');

    const lines = [
      `[Cyrus V2 Metrics] Pipeline completed:`,
      `  Input: ${m.totalInput} articles → ${m.uniqueLabels} uniques`,
      `  Cache: ${m.cacheHits} hits (${cacheRate}%)`,
      `  Routing: ${totalRouted} labels → ${m.routingResults.highConfidence} high / ${m.routingResults.mediumConfidence} medium / ${m.routingResults.lowConfidence} low confidence`,
      `  Experts: ${m.expertCalls} calls across sectors [${m.sectorsUsed.join(', ')}]`,
      `  Validation: ${m.validationResults.classified} classified / ${m.validationResults.needsReview} needs_review / ${m.validationResults.fallbackUsed} fallback`,
      `  Duration: ${durationSec}s (${stepDurations})`,
      `  Tokens estimate: ~${m.tokensEstimate.toLocaleString()}`,
    ];

    console.log(lines.join('\n'));
  }
}
