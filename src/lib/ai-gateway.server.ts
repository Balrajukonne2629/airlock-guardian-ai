// Server-only Lovable AI Gateway helper: streamed Chat Completions with a forced tool call.
// One model for every call (classifier, naive triage, airlock triage) so comparisons are fair.
export const AI_MODEL = "google/gemini-3-flash-preview";

export class AiGatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface ToolSpec {
  name: string;
  description: string;
  parameters: object;
}

async function once(system: string, user: string, tool: ToolSpec): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiGatewayError(401, "AI is not configured for this project.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [{ type: "function", function: tool }],
      tool_choice: { type: "function", function: { name: tool.name } },
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
  let args = "";
  let content = "";
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
      let ev: {
        error?: { message?: string };
        choices?: { delta?: { content?: string; tool_calls?: { function?: { arguments?: string } }[] } }[];
      };
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.error) throw new AiGatewayError(500, ev.error.message ?? "AI stream failed.");
      const d = ev.choices?.[0]?.delta;
      if (d?.content) content += d.content;
      for (const tc of d?.tool_calls ?? []) if (tc.function?.arguments) args += tc.function.arguments;
    }
  }
  const raw = args.trim() || content.trim().replace(/^```(json)?|```$/g, "");
  if (!raw) throw new AiGatewayError(500, "AI returned an empty response.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AiGatewayError(500, "AI returned malformed output.");
  }
}

/** One bounded retry with backoff for 429/5xx; 402 and other errors surface immediately. */
export async function callTool<T>(system: string, user: string, tool: ToolSpec): Promise<T> {
  try {
    return (await once(system, user, tool)) as T;
  } catch (e) {
    const status = e instanceof AiGatewayError ? e.status : 500;
    if (status === 429 || status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
      return (await once(system, user, tool)) as T;
    }
    throw e;
  }
}
