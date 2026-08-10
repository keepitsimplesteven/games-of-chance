/// <reference types="@cloudflare/workers-types" />

interface Env {
  GameRoom: DurableObjectNamespace;
  ASSETS: Fetcher;
}
