import { apiClient } from '@/data/http/api-client';

export type PerformanceEventName =
  | 'cold_start'
  | 'screen_tti'
  | 'long_operation'
  | 'player_startup'
  | 'player_buffer';

export interface PerformanceEvent {
  name: PerformanceEventName;
  durationMs: number;
  timestamp: number;
  context?: Record<string, string | number | boolean>;
}

const MAX_EVENTS = 50;
const MAX_CONTEXT_KEYS = 8;
const queue: PerformanceEvent[] = [];
let sending = false;
const processStartedAt = Date.now();

function safeContext(context?: PerformanceEvent['context']) {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, MAX_CONTEXT_KEYS)
      .map(([key, value]) => [key.slice(0, 40), typeof value === 'string' ? value.slice(0, 100) : value]),
  );
}

export function recordPerformance(
  name: PerformanceEventName,
  durationMs: number,
  context?: PerformanceEvent['context'],
): void {
  queue.push({
    name,
    durationMs: Math.max(0, Math.round(durationMs)),
    timestamp: Date.now(),
    context: safeContext(context),
  });
  if (queue.length > MAX_EVENTS) queue.splice(0, queue.length - MAX_EVENTS);
}

export function markColdStartReady(): void {
  recordPerformance('cold_start', Date.now() - processStartedAt);
  void flushPerformanceEvents();
}

export function startOperation(
  name: PerformanceEventName,
  context?: PerformanceEvent['context'],
): () => number {
  const started = Date.now();
  return () => {
    const duration = Date.now() - started;
    recordPerformance(name, duration, context);
    return duration;
  };
}

export async function flushPerformanceEvents(): Promise<void> {
  if (sending || !queue.length) return;
  sending = true;
  const batch = queue.splice(0, 20);
  try {
    await apiClient.post('/analytics/events', {
      events: batch.map((event) => ({
        name: event.name,
        metadata: { durationMs: event.durationMs, ...event.context },
        occurredAt: new Date(event.timestamp).toISOString(),
      })),
    }, { timeout: 8_000 });
  } catch {
    queue.unshift(...batch);
    if (queue.length > MAX_EVENTS) queue.length = MAX_EVENTS;
  } finally {
    sending = false;
  }
}

export function getPerformanceQueueSize(): number {
  return queue.length;
}
