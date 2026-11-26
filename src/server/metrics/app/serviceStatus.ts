/** The last known state of one external service, in memory only. */
export interface ServiceStatus {
  report(available: boolean): void;
  /** Null until the first report, so also after a restart. */
  current(): boolean | null;
}

export class InMemoryServiceStatus implements ServiceStatus {
  private available: boolean | null = null;

  report(available: boolean): void {
    this.available = available;
  }

  current(): boolean | null {
    return this.available;
  }
}

// Bundles may contain this module more than once, so the instance lives on globalThis.
declare global {
  var geogrindNominatimStatus: ServiceStatus | undefined;
}

export function sharedNominatimStatus(): ServiceStatus {
  globalThis.geogrindNominatimStatus ??= new InMemoryServiceStatus();
  return globalThis.geogrindNominatimStatus;
}
