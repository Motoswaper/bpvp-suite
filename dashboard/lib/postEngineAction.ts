export type EngineActionInput = {
  module: "bpvp20" | "bpvp721" | "market" | "trust" | "lend" | "settle" | "otc";
  type: string;
  data?: Record<string, unknown>;
};

export async function postEngineAction(input: EngineActionInput): Promise<unknown> {
  const res = await fetch("/api/engine/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data;
}
