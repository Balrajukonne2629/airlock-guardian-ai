// Server-only Lovable AI Gateway helper (Responses API, streamed, strict JSON schema).
export const AI_MODEL = "openai/gpt-6-astra";

export class AiGatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function once(system: string, user: string, schemaName: string, schema: object): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiGatewayError(401, "AI is not configured for this project.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
    }),
  });
  if (!res.ok || !res.body) {
    let msg = `AI request failed (${res.status}).`;
    try {
      const j = (await res.json()) as { message?: string; error?: { message?: string } };
      msg = j.message ?? j.error?.message ?? msg;
    } catch {}
    if (res.status === 429) msg = "AI rate limit reached. Please wait a moment and try again.";
    if (res.status === 402) msg = "AI credits are exhausted. Add credits in Settings → Plans & credits.";
    throw new AiGatewayError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed")
          throw new AiGatewayError(500, ev.error?.message ?? ev.response?.error?.message ?? "AI stream failed.");
      } catch (e) {
        if (e instanceof AiGatewayError) throw e;
      }
    }
  }
  if (!text.trim()) throw new AiGatewayError(500, "AI returned an empty response.");
  return JSON.parse(text);
}

/** One bounded retry for 429/5xx, then surface a clear error. */
export async function callJson<T>(system: string, user: string, schemaName: string, schema: object): Promise<T> {
  try {
    return (await once(system, user, schemaName, schema)) as T;
  } catch (e) {
    const status = e instanceof AiGatewayError ? e.status : 500;
    if (status === 429 || status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
      return (await once(system, user, schemaName, schema)) as T;
    }
    throw e;
  }
}
