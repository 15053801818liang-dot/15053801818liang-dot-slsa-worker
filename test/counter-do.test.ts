/**
 * CounterDO 行为测试 — 基于 src/index.ts 源码真实行为编写
 *
 * 测试策略：
 *   - 真实实例化 src/index.ts 导出的 CounterDO 类
 *   - 以内存 Map 模拟 DurableObjectState.storage 的 get/put 语义
 *     （CounterDO 仅依赖 storage.get/put 两个接口，无需真实 Cloudflare 运行时）
 *   - 以标准 Request 对象驱动 fetch，验证路由分发 / 状态转移 / 响应契约
 *
 * 覆盖面（对应 Task 12 计划）：
 *   1. INITIAL_STATE        — 空 storage 下 /value 返回 {count:0}（验证 ?? 0 语义）
 *   2. STATE_INCREMENT      — /increment 使计数 +1 且持久化到 storage
 *   3. MULTIPLE_SEQUENTIAL  — 连续 increment×3 / decrement×1 → 2（跨请求保留）
 *   4. EXPECTED_RESPONSE    — JSON content-type 契约
 *   5. RESET                — 计数 5 后 reset → 0
 *   6. FAILURE/BOUNDARY     — 未知路径 → 404 "Not Found"
 */

import { describe, it, expect } from "vitest";
import { CounterDO } from "../src/index";

/** 内存 storage：模拟 DurableObjectState.storage 的最小契约（get/put） */
class MemoryStorage {
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
}

/** 构造一个真实 CounterDO 实例 + 独立 storage（每个用例隔离状态） */
function makeCounter() {
  const storage = new MemoryStorage();
  const state = { storage } as unknown as DurableObjectState;
  const env = {} as Env;
  const counter = new CounterDO(state, env);
  return { counter, storage };
}

const BASE = "https://counter.example";

describe("CounterDO 计数语义（对照 src/index.ts）", () => {
  it("INITIAL_STATE: 空 storage 下 /value 返回 {count:0}", async () => {
    const { counter } = makeCounter();
    const res = await counter.fetch(new Request(`${BASE}/value`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0 });
  });

  it("STATE_INCREMENT: /increment 返回 {count:1} 且持久化到 storage", async () => {
    const { counter, storage } = makeCounter();
    const res = await counter.fetch(new Request(`${BASE}/increment`));
    expect(await res.json()).toEqual({ count: 1 });
    // 持久化语义：storage 中 count 键确为 1
    expect(await storage.get<number>("count")).toBe(1);
  });

  it("MULTIPLE_SEQUENTIAL: increment×3 + decrement×1 → 2（跨请求保留）", async () => {
    const { counter, storage } = makeCounter();
    await counter.fetch(new Request(`${BASE}/increment`));
    await counter.fetch(new Request(`${BASE}/increment`));
    await counter.fetch(new Request(`${BASE}/increment`));
    const res = await counter.fetch(new Request(`${BASE}/decrement`));
    expect(await res.json()).toEqual({ count: 2 });
    expect(await storage.get<number>("count")).toBe(2);
  });

  it("RESET: 计数 5 后 /reset → 0 且持久化", async () => {
    const { counter, storage } = makeCounter();
    for (let i = 0; i < 5; i++) {
      await counter.fetch(new Request(`${BASE}/increment`));
    }
    const res = await counter.fetch(new Request(`${BASE}/reset`));
    expect(await res.json()).toEqual({ count: 0 });
    expect(await storage.get<number>("count")).toBe(0);
  });
});

describe("CounterDO 响应契约与错误路径", () => {
  it("EXPECTED_RESPONSE: 响应为 application/json", async () => {
    const { counter } = makeCounter();
    const res = await counter.fetch(new Request(`${BASE}/increment`));
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("FAILURE/BOUNDARY: 未知路径返回 404 Not Found", async () => {
    const { counter } = makeCounter();
    const res = await counter.fetch(new Request(`${BASE}/unknown-path`));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not Found");
  });
});
