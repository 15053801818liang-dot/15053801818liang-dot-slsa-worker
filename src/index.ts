/**
 * SLSA L3 加固模板 — Cloudflare Worker + Durable Object
 *
 * 这是一个真实可用的最小示例：一个持久化计数器 DO。
 * 非占位符 stub —— `npm run build` 可产出可部署的 bundle。
 */

export interface Env {
  COUNTER: DurableObjectNamespace;
}

/**
 * Durable Object：维护一个持久化计数器。
 * 通过 storage API 持久化状态，跨请求保留。
 */
export class CounterDO implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let value = (await this.state.storage.get<number>("count")) ?? 0;

    switch (url.pathname) {
      case "/increment":
        value += 1;
        await this.state.storage.put("count", value);
        break;
      case "/decrement":
        value -= 1;
        await this.state.storage.put("count", value);
        break;
      case "/reset":
        value = 0;
        await this.state.storage.put("count", value);
        break;
      case "/":
      case "/value":
        // 只读，不修改
        break;
      default:
        return new Response("Not Found", { status: 404 });
    }

    return new Response(JSON.stringify({ count: value }), {
      headers: { "content-type": "application/json" },
    });
  }
}

/**
 * Worker 入口：将请求路由到全局计数器 DO。
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.COUNTER.idFromName("global");
    return env.COUNTER.get(id).fetch(request);
  },
};
