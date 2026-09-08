/**
 * The judgment layer. This is the component the AI track is scored on.
 *
 * It is a single Claude call with the underwriter's brief, the proven evidence,
 * and a strict schema for the answer. There is no scoring function anywhere in
 * this path, and deliberately so (T13): the decision is a reading of evidence,
 * and two careful readers could reach different terms on the same dossier.
 *
 * Rule 7, fail closed. If the model is unreachable, refuses, or returns a
 * verdict that does not validate, this throws. It never falls back to a default
 * decision, because a silent fallback would be a formula wearing the
 * underwriter's name.
 */
import Anthropic from '@anthropic-ai/sdk';

import { validateVerdict, type Verdict } from './verdict';

export const UNDERWRITER_MODEL = 'claude-opus-5';

const VERDICT_TOOL: Anthropic.Tool = {
  name: 'submit_verdict',
  description: 'Record the underwriting decision, its terms, and the reasoning behind it.',
  strict: true,
  input_schema: {
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
  },
};

export type Judgment = { verdict: Verdict; model: string };

export async function judge(system: string, prompt: string): Promise<Judgment> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. The underwriter refuses rather than falling back to a formula.'
    );
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: UNDERWRITER_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system,
    tools: [VERDICT_TOOL],
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nWhen you have reached a decision, record it by calling submit_verdict.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `The model declined to answer (${response.stop_details?.category ?? 'unknown'}). No verdict was produced.`
    );
  }

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_verdict'
  );
  if (!call) {
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    throw new Error(`The underwriter returned no verdict. It said:\n${text.slice(0, 800)}`);
  }

  return { verdict: validateVerdict(call.input), model: UNDERWRITER_MODEL };
}
