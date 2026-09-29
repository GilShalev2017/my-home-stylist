import { describe, expect, it } from 'vitest';
import { classifyError, HttpError } from './http';

describe('classifyError', () => {
  it('maps OpenAI safety rejections', () => {
    const c = classifyError({ status: 400, code: 'moderation_blocked', message: '400 Your request was rejected by the safety system.' });
    expect(c.code).toBe('safety_rejected');
  });
  it('maps billing / quota problems', () => {
    expect(classifyError({ status: 429, code: 'insufficient_quota', message: 'You exceeded your current quota' }).code).toBe('no_credit');
    expect(classifyError({ status: 400, message: 'Billing hard limit has been reached' }).code).toBe('no_credit');
  });
  it('maps rate limits, auth, verification and timeouts', () => {
    expect(classifyError({ status: 429, message: 'Rate limit reached' }).code).toBe('rate_limited');
    expect(classifyError({ status: 401, message: 'Incorrect API key' }).code).toBe('provider_auth');
    expect(classifyError({ status: 403, message: 'Your organization must be verified to use gpt-image-1.5' }).code).toBe('org_verification');
    expect(classifyError({ name: 'APIConnectionTimeoutError', message: 'Request timed out.' }).code).toBe('provider_timeout');
  });
  it('keeps explicit HttpErrors and never returns an empty message', () => {
    expect(classifyError(new HttpError(413, 'Image too large', 'image_too_large'))).toEqual({ status: 413, code: 'image_too_large', message: 'Image too large' });
    expect(classifyError(undefined).message.length).toBeGreaterThan(0);
  });
});
