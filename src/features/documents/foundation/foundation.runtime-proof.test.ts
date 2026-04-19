// ═══════════════════════════════════════════════════════════════
// Foundation Gate — Runtime Proof (vitest)
// ═══════════════════════════════════════════════════════════════
// 3 cases + 1 negative case. NO mocks of foundation internals.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { runFoundation } from './index';
import { assertNoExternalRawPath, PrivacyViolationError } from './privacy-guard';

function makeFile(name: string, type: string, body: BlobPart): File {
  const blob = new Blob([body], { type });
  return new File([blob], name, { type });
}

function buf(...bytes: number[]): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return ab;
}

describe('Foundation Gate — runtime proof', () => {
  it('PASSPORT (filename signal) → passport_lane, no false confidence without MRZ peek', async () => {
    const file = makeFile('AhmedAli_Passport.pdf', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46])); // "%PDF" header only
    const out = await runFoundation({ document_id: 'doc_passport_1', file });
    expect(out.route.route_family).toBe('passport_id');
    expect(out.route.selected_lane).toBe('passport_lane');
    expect(out.privacy_blocked).toBe(false);
    expect(out.normalized.document_id).toBe('doc_passport_1');
    expect(out.normalized.provenance.local_only).toBe(true);
    expect(out.review.requires_review).toBe(out.route.requires_review);
    console.log('[PROOF passport]', JSON.stringify(out.route, null, 2));
  });

  it('SIMPLE CERTIFICATE → graduation_lane + requires_review (honesty gate)', async () => {
    const file = makeFile('university_graduation_certificate.pdf', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const out = await runFoundation({ document_id: 'doc_cert_1', file });
    expect(out.route.route_family).toBe('graduation_certificate');
    expect(out.route.selected_lane).toBe('graduation_lane');
    expect(out.route.requires_review).toBe(true); // graduation always pending review in V1
    expect(out.processing_state).toBe('needs_review');
    console.log('[PROOF certificate]', JSON.stringify(out.route, null, 2));
  });

  it('UGLY/UNKNOWN FILE → unknown_document, low confidence, sent to review', async () => {
    const file = makeFile('IMG_8472.png', 'image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const out = await runFoundation({ document_id: 'doc_unknown_1', file });
    expect(out.route.route_family).toBe('unknown_document');
    expect(out.route.route_confidence).toBe(0);
    expect(out.route.requires_review).toBe(true);
    expect(out.review.review_status).toBe('pending');
    expect(out.processing_state).toBe('needs_review');
    console.log('[PROOF unknown]', JSON.stringify(out.route, null, 2));
  });

  it('NEGATIVE: unknown file is NOT confidently classified into any real family', async () => {
    const file = makeFile('scan001.jpg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]));
    const out = await runFoundation({ document_id: 'doc_neg_1', file });
    // The router MUST NOT pretend to know.
    expect(out.route.route_family).toBe('unknown_document');
    expect(out.route.route_confidence).toBeLessThan(0.5);
    expect(['passport_id', 'graduation_certificate', 'language_certificate', 'academic_transcript'])
      .not.toContain(out.route.route_family);
    console.log('[PROOF negative]', JSON.stringify(out.route, null, 2));
  });

  it('PRIVACY GUARD: blocks known external endpoints', () => {
    expect(() => assertNoExternalRawPath('https://api.openai.com/v1/foo', 'test'))
      .toThrow(PrivacyViolationError);
    expect(() => assertNoExternalRawPath('https://api.mistral.ai/v1/ocr', 'test'))
      .toThrow(PrivacyViolationError);
    expect(() => assertNoExternalRawPath('https://example.com/anything', 'test'))
      .not.toThrow();
  });
});
