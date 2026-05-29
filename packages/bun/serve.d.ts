// bun:serve type definitions

export interface ServerRequest extends Request {
  params: Record<string, string>;
}

export interface ServerIP {
  address: string;
  family: string;
  port: number;
}

export interface ServeOptions {
  port?: number;
  hostname?: string;
  fetch: (request: ServerRequest, server: Server) => Response | Promise<Response>;
  error?: (error: Error) => Response;
  routes?: Record<string, Response | ((req: ServerRequest, server: Server) => Response | Promise<Response>) | Record<string, Response | ((req: ServerRequest, server: Server) => Response | Promise<Response>)>>;
  idleTimeout?: number;
  development?: boolean;
  unix?: string;
}

export class Server {
  readonly port: number;
  readonly hostname: string;
  readonly url: URL;
  readonly development: boolean;
  readonly id: string;
  readonly pendingRequests: number;
  readonly pendingWebSockets: number;
  readonly ready: Promise<Server>;

  constructor(options?: ServeOptions);

  stop(closeActiveConnections?: boolean): Promise<void>;
  reload(options?: Partial<ServeOptions>): void;
  timeout(request: ServerRequest, seconds: number): void;
  requestIP(request: ServerRequest): ServerIP | null;
  ref(): void;
  unref(): void;
  publish(topic: string, data: string | BufferSource): number;
  subscriberCount(topic: string): number;
  fetch(request: Request): Response | Promise<Response>;
}

export function serve(options?: ServeOptions): Server;
