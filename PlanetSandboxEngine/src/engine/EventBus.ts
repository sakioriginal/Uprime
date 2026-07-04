export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
  }

  emit<T>(event: string, payload: T): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const handler of list) handler(payload);
  }
}
