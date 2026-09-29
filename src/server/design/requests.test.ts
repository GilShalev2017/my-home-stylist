import { describe, expect, it } from 'vitest';
import { parseRequestedSlots } from './requests';

describe('parseRequestedSlots', () => {
  it('understands large furniture requests in English', () => {
    expect(parseRequestedSlots('Please use any IKEA closets').slots).toContain('wardrobe');
    expect(parseRequestedSlots('I want a new sofa and a coffee table').slots).toEqual(expect.arrayContaining(['sofa', 'coffee_table']));
    expect(parseRequestedSlots('add a dining table').slots).toEqual(expect.arrayContaining(['dining_table', 'dining_chair']));
  });
  it('understands Hebrew', () => {
    expect(parseRequestedSlots('תוסיף ארון בגדים לבן').slots).toContain('wardrobe');
    expect(parseRequestedSlots('ספה חדשה בבקשה').slots).toContain('sofa');
    expect(parseRequestedSlots('פינת אוכל עם כיסאות').slots).toEqual(expect.arrayContaining(['dining_table', 'dining_chair']));
  });
  it('ignores negated mentions', () => {
    expect(parseRequestedSlots("Don't change the sofa").slots).not.toContain('sofa');
    expect(parseRequestedSlots('Keep my wardrobe as it is').slots).not.toContain('wardrobe');
  });
  it('handles kitchen cabinets honestly', () => {
    const r = parseRequestedSlots('use IKEA kitchen closets');
    expect(r.slots).not.toContain('wardrobe');
    expect(r.slots).toContain('bookcase');
    expect(r.notes[0]).toMatch(/made to measure/);
    const he = parseRequestedSlots('ארונות מטבח חדשים');
    expect(he.slots).not.toContain('wardrobe');
    expect(he.notes.length).toBe(1);
  });
  it('returns nothing for style-only text', () => {
    expect(parseRequestedSlots('Make it warmer and more luxurious. Use beige and warm wood.').slots).toEqual([]);
  });
});
