// Airlock Layer 1: deterministic regex / heuristic rules. Pure, client-safe, unit-tested.

export type RuleStrength = "high" | "weak";
export interface RuleHit {
  rule: string;
  strength: RuleStrength;
  match: string;
  start: number;
  end: number;
  note?: string;
}

interface Rule {
  id: string;
  strength: RuleStrength;
  re: RegExp;
  /** extend span to end of sentence (for instruction-style phrases) */
  sentence?: boolean;
}

const RULES: Rule[] = [
  // Override phrases
  { id: "override.ignore_previous", strength: "high", sentence: true,
    re: /\b(ignore|disregard|forget|override)\s+(all\s+)?(of\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|preceding)\b[^.\n]*/gi },
  { id: "override.new_instruction", strength: "high", sentence: true,
    re: /\b(new\s+instructions?\s*:|your\s+only\s+task\s+(now\s+)?is|stop\s+analy[sz]ing)/gi },
  { id: "override.role_reassign", strength: "high", sentence: true,
    re: /\b(you\s+are\s+(now|no\s+longer)|from\s+now\s+on\s+you\s+are|act\s+as\s+(the|an?)\s|pretend(_|\s+)you(_|\s+)are)/gi },
  { id: "override.ai_addressed", strength: "high", sentence: true,
    re: /\b(note[-\s]to[-\s]ai|ai[_\s]instruction|ai\s+reviewer|assistant\s*,?\s+please|attention\s+(ai|assistant|llm))\b/gi },
  { id: "override.severity_directive", strength: "weak", sentence: true,
    re: /\b(mark|set|rate|classify|downgrade|label)\s+(this|it|the\s+alert|all\s+alerts)?[^.\n]{0,40}\b(low|false\s+positive|benign)\b/gi },
  { id: "override.canary_output", strength: "high", sentence: true,
    re: /\b(output|write|print|include|say|append|confirm\s+(by|with))\b[^.\n]{0,60}\bCANARY-\d{3,5}\b/gi },

  // Fake system / role tags
  { id: "tag.fake_system", strength: "high",
    re: /<\|?\s*\/?\s*(system|im_start|im_end|assistant|instructions?)\s*\|?>|\[\/?\s*(SYSTEM|INST)\s*\]|###\s*SYSTEM|\bSYSTEM\s*(MESSAGE)?\s*:/g },
  { id: "tag.evidence_escape", strength: "high", re: /<\/\s*(evidence|quoted_evidence|data|context)\s*>/gi },

  // Tool-call imitation
  { id: "toolcall.imitation", strength: "high",
    re: /("tool_call"|"function_call"|<\s*function_call\b|<\s*tool_use\b|"function"\s*:\s*"[a-z_]+"|assistant_tool\s*:|\b[a-z_]+\.(update|set_severity|close)\s*\()/gi },

  // Exfiltration
  { id: "exfil.prompt_leak", strength: "high", sentence: true,
    re: /\b(print|reveal|show|include|repeat|dump)\b[^.\n]{0,30}\b(system\s+prompt|hidden\s+instructions|api\s+keys?|secrets?)\b/gi },
  { id: "exfil.send_to", strength: "high", sentence: true,
    re: /\b(send|post|forward|upload)\b[^.\n]{0,40}\bto\s+https?:\/\/\S+/gi },

  // Multilingual override phrases
  { id: "ml.es", strength: "high", sentence: true, re: /\bignora\s+(todas\s+)?las\s+instrucciones/gi },
  { id: "ml.fr", strength: "high", sentence: true, re: /\bignorez\s+(toutes\s+)?les\s+instructions/gi },
  { id: "ml.de", strength: "high", sentence: true, re: /\bignoriere\s+(alle\s+)?(vorherigen\s+)?anweisungen/gi },
  { id: "ml.hi", strength: "high", sentence: true, re: /(निर्देशों\s*को\s*(अनदेखा|नज़रअंदाज़|नजरअंदाज)|\bpichle\s+(sabhi\s+)?nirdesh)/gi },
  { id: "ml.zh", strength: "high", sentence: true, re: /忽略(之前|以前|先前|上面|所有)[^。]*?(指令|说明|指示)/g },
  { id: "ml.ja", strength: "high", sentence: true, re: /(前|以前)の指示を無視/g },
];

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const BASE64 = /[A-Za-z0-9+/]{16,}={0,2}/g;

function sentenceEnd(text: string, from: number) {
  const m = /[.!?。\n]|<\/|\)\s*$/.exec(text.slice(from));
  return m ? from + m.index + (m[0] === "." || m[0] === "!" || m[0] === "?" || m[0] === "。" ? 1 : 0) : text.length;
}

function decodeBase64(s: string): string | null {
  try {
    const bin = typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary");
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const txt = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // only treat as text if mostly printable
    const printable = txt.replace(/[^\x20-\x7E\s]/g, "").length;
    return printable / Math.max(txt.length, 1) > 0.9 ? txt : null;
  } catch {
    return null;
  }
}

function runRules(text: string): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(text))) {
      const start = m.index;
      const end = r.sentence ? Math.max(start + m[0].length, sentenceEnd(text, start + m[0].length)) : start + m[0].length;
      hits.push({ rule: r.id, strength: r.strength, match: text.slice(start, end), start, end });
      if (m[0].length === 0) r.re.lastIndex++;
    }
  }
  return hits;
}

export function scanLayer1(text: string): RuleHit[] {
  const hits = runRules(text);

  ZERO_WIDTH.lastIndex = 0;
  const zw = text.match(ZERO_WIDTH);
  if (zw) hits.push({ rule: "unicode.zero_width", strength: "high", match: `${zw.length} invisible char(s)`, start: -1, end: -1 });

  BASE64.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BASE64.exec(text))) {
    const decoded = decodeBase64(m[0]);
    if (!decoded) continue;
    const inner = runRules(decoded);
    if (inner.some((h) => h.strength === "high") || inner.length) {
      hits.push({
        rule: "encoded.base64_instruction",
        strength: "high",
        match: m[0],
        start: m.index,
        end: m.index + m[0].length,
        note: `decoded: "${decoded.slice(0, 120)}"`,
      });
    }
  }
  return hits;
}

/** Replace hit spans with [QUARANTINED]; strip zero-width chars. */
export function quarantine(text: string, hits: RuleHit[]): string {
  const spans = hits.filter((h) => h.start >= 0).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ start: s.start, end: s.end });
  }
  let out = "";
  let pos = 0;
  for (const s of merged) {
    out += text.slice(pos, s.start) + "[QUARANTINED]";
    pos = s.end;
  }
  out += text.slice(pos);
  return out.replace(ZERO_WIDTH, "");
}

export type Verdict = "clean" | "suspicious" | "injection";

export function combineVerdict(hits: RuleHit[], layer2: Verdict | "unavailable"): Verdict {
  if (hits.some((h) => h.strength === "high") || layer2 === "injection") return "injection";
  if (hits.length > 0 || layer2 === "suspicious") return "suspicious";
  return "clean";
}

export function wrapEvidence(text: string) {
  return `<quoted_evidence>\n${text}\n</quoted_evidence>`;
}
