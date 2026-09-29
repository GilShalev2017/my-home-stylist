import { describe, expect, it } from 'vitest';
import { ANALYSIS_SCHEMA, BRIEF_SCHEMA, toStructuredSchema } from './anthropic';

const FORBIDDEN = ['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'multipleOf', 'uniqueItems', 'pattern'];

function check(node: unknown, path = '$') {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  for (const k of FORBIDDEN) expect(k in n, `${path} has ${k}`).toBe(false);
  if (Array.isArray(n.enum)) expect(n.enum.every((v) => typeof v === 'string'), `${path} has non-string enum`).toBe(true);
  if (n.type === 'object') expect(n.additionalProperties, `${path} missing additionalProperties:false`).toBe(false);
  if (n.properties) for (const [k, v] of Object.entries(n.properties as object)) check(v, `${path}.${k}`);
  if (n.items) check(n.items, `${path}[]`);
}

describe('structured output schemas', () => {
  it('room analysis schema is valid for structured outputs', () => check(toStructuredSchema(ANALYSIS_SCHEMA)));
  it('design brief schema is valid for structured outputs', () => check(toStructuredSchema(BRIEF_SCHEMA)));
  it('keeps dropped constraints as description hints', () => {
    const s = toStructuredSchema({ type: 'object', properties: { q: { type: 'integer', minimum: 1, maximum: 4 }, p: { type: 'integer', enum: [1, 2, 3] } } }) as {
      properties: Record<string, { description: string }>;
    };
    expect(s.properties.q.description).toContain('minimum: 1');
    expect(s.properties.p.description).toContain('one of 1, 2, 3');
  });
});
