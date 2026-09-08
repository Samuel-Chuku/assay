/**
 * The judgment layer. This is the scored component.
 *
 * One call with the underwriter's brief, the proven evidence, and a strict
 * schema for the answer. There is no scoring function anywhere in this path,
 * deliberately (T13): the decision is a reading of evidence, and two careful
 * readers could reach different terms on the same dossier.
 *
 * Provider-neutral. Endpoint, model and credential are all configuration, so
 * swapping any of them costs nothing. The deterministic rails around this call
 * bound what a verdict may contain, never what it should conclude, so a weaker
 * judge is safe to try here but is not thereby made a better one.
 * `pnpm underwrite:qualify` is how you find out whether one can actually tell
 * the two demo agents apart.
 *
 * Rule 7, fail closed. If the endpoint is unreachable, returns nothing usable,
 * or produces a verdict that does not validate, this throws. It never falls
 * back to a default decision, because a silent fallback would be a formula
 * wearing the underwriter's name.
 */
import { LLM_BASE_URL, LLM_MODEL, LLM_TEMPERATURE } from '../config/underwriting';
import { validateVerdict, type Verdict } from './verdict';

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    approve: {
      type: 'boolean',
      description: 'Whether to extend a credit line at all.',
    },
    credit_limit: {
      type: 'string',
      description: 'Total drawable amount in tCTC, as a decimal string. Exactly "0" when refusing.',
    },
    collateral_ratio: {
      type: 'number',
      description:
        'Collateral required as a fraction of the limit, 0 to 1. Raise it to price uncertainty you can live with.',
    },
    rate_bps: {
      type: 'integer',
      description: 'Fixed simple interest on each draw, in basis points. 500 is 5 percent.',
    },
    confidence: {
      type: 'number',
      description: 'How much weight the evidence actually carries, 0 to 1. Not enthusiasm for the decision.',
    },
    reasoning: {
      type: 'string',
      description:
        'The written judgment, for a lender who may disagree. Name the considerations that decided it, cite specific figures and addresses, and say what would change your mind.',
    },
    evidence_used: {
      type: 'array',
      items: { type: 'string' },
      description: 'The specific proven facts the decision rested on.',
    },
  },
  required: [
    'approve',
    'credit_limit',
    'collateral_ratio',
    'rate_bps',
    'confidence',
    'reasoning',
    'evidence_used',
  ],
} as const;

export type Judgment = {
  verdict: Verdict;
  model: string;
  /** What the call actually cost, when the endpoint reports it. */
  usage: { promptTokens: number; completionTokens: number; costUsd: number | null };
};

/** Judges vary in how obediently they return bare JSON. Recover the object. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error(`The underwriter returned no JSON object. It said:\n${trimmed.slice(0, 800)}`);
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

export async function judge(system: string, prompt: string, model = LLM_MODEL): Promise<Judgment> {
  const key = process.env.LLM_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      'LLM_API_KEY is not set. The underwriter refuses rather than falling back to a formula.'
    );
  }

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Assay Underwriter',
    },
    body: JSON.stringify({
      model,
      temperature: LLM_TEMPERATURE,
      usage: { include: true },
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `${prompt}\n\nReturn only a JSON object matching the required schema. No prose outside it.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'verdict', strict: true, schema: VERDICT_SCHEMA },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Judgment endpoint returned HTTP ${response.status} for ${model}: ${body.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };

  if (payload.error) {
    throw new Error(`Judgment endpoint error: ${payload.error.message ?? 'unknown'}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error(
      `${model} returned an empty response (finish_reason: ${
        payload.choices?.[0]?.finish_reason ?? 'unknown'
      }). No verdict was produced.`
    );
  }

  return {
    verdict: validateVerdict(extractJson(content)),
    model,
    usage: {
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      costUsd: payload.usage?.cost ?? null,
    },
  };
}
