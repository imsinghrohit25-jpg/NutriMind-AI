import { describe, it, expect } from 'vitest';
import { detectScript, needsCloudOcrFallback } from '../script-detector.js';

describe('detectScript', () => {
  it('detects Latin', () => {
    expect(detectScript('Energy 390 kcal, Protein 10.5 g')).toBe('latin');
  });

  it('detects Devanagari', () => {
    expect(detectScript('गेहूं का आटा, चीनी, नमक')).toBe('devanagari');
  });

  it('detects Arabic', () => {
    expect(detectScript('الطاقة ٣٩٠ سعرة حرارية')).toBe('arabic');
  });

  it('detects Tamil', () => {
    expect(detectScript('ஆற்றல் புரோட்டீன் கொழுப்பு')).toBe('tamil');
  });

  it('detects Telugu', () => {
    expect(detectScript('శక్తి ప్రోటీన్ కొవ్వు')).toBe('telugu');
  });

  it('detects CJK (Chinese)', () => {
    expect(detectScript('能量 蛋白质 脂肪')).toBe('cjk');
  });

  it('detects CJK (Japanese, mixed kanji/kana)', () => {
    expect(detectScript('エネルギー たんぱく質 脂質')).toBe('cjk');
  });

  it('detects Korean', () => {
    expect(detectScript('에너지 단백질 지방')).toBe('korean');
  });

  it('picks the dominant script in mixed text', () => {
    // Mostly Devanagari with a small English brand name — Devanagari wins by character count.
    expect(detectScript('Brand: गेहूं का आटा एक स्वस्थ विकल्प है और भी बहुत कुछ')).toBe('devanagari');
  });

  it('defaults to latin for empty/numeric-only text', () => {
    expect(detectScript('')).toBe('latin');
    expect(detectScript('   ')).toBe('latin');
    expect(detectScript('123 456')).toBe('latin');
  });
});

describe('needsCloudOcrFallback', () => {
  it('does not need fallback for ML-Kit-supported scripts', () => {
    expect(needsCloudOcrFallback('latin')).toBe(false);
    expect(needsCloudOcrFallback('devanagari')).toBe(false);
    expect(needsCloudOcrFallback('cjk')).toBe(false);
    expect(needsCloudOcrFallback('korean')).toBe(false);
  });

  it('needs fallback for scripts ML Kit does not support well', () => {
    expect(needsCloudOcrFallback('arabic')).toBe(true);
    expect(needsCloudOcrFallback('tamil')).toBe(true);
    expect(needsCloudOcrFallback('telugu')).toBe(true);
    expect(needsCloudOcrFallback('other')).toBe(true);
  });
});
