import { describe, expect, test } from 'vitest';
import { normalizeText, isMostlyScript } from '../../src/lib/text';

describe('normalizeText', () => {
  test('quotes, dashes, whitespace', () => {
    expect(normalizeText('“Hello” – world  ')).toBe('"Hello" - world');
    expect(normalizeText('a  b\n c')).toBe('a b c');
    expect(normalizeText('it’s — ok')).toBe("it's - ok");
  });
  test('NFC: precomposed and decomposed Devanagari match', () => {
    const cp = (...n: number[]) => String.fromCodePoint(...n);
    expect(normalizeText(cp(0x0958))).toBe(normalizeText(cp(0x0915, 0x093c)));
    expect(normalizeText(cp(0xe9))).toBe(normalizeText(cp(0x65, 0x301)));
    expect(normalizeText(cp(0x0958))).toBe(cp(0x0915, 0x093c));
  });
});

describe('isMostlyScript', () => {
  test('hi / kn / te', () => {
    expect(isMostlyScript('मन की बात', 'hi')).toBe(true);
    expect(isMostlyScript('Mann Ki Baat', 'hi')).toBe(false);
    expect(isMostlyScript('ಮನ್ ಕಿ ಬಾತ್', 'kn')).toBe(true);
    expect(isMostlyScript('மன் கி பாத்', 'te')).toBe(false);
  });
  test('en is always true; tolerates some Latin (acronyms)', () => {
    expect(isMostlyScript('anything', 'en')).toBe(true);
    expect(isMostlyScript('पीएम PM-KISAN योजना किसानों के लिए', 'hi')).toBe(true);
  });
});
