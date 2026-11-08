import type { RequestWithIdentity } from '../../../../../../shared/http/identity';
import type {
  RequestEvidenceDocumentUploadPort,
} from '../../../application/port/in/request-evidence-document-upload';
import type { ReadSkillEvidenceDocumentPort } from '../../../application/port/in/read-skill-evidence-document';
import { SkillEvidenceController } from './skill-evidence.controller';

/**
 * FR-003: the two routes B9 adds.
 *
 * The interesting part is not the delegation but the **routing table**. `POST /skill-evidence/documents`
 * is a literal segment and `GET /skill-evidence/:id/document` is a parameterised one; Nest matches in
 * declaration order, so a literal declared after a parameterised sibling is unreachable. That is a
 * defect no unit test on the handler would catch, because the handler is never called.
 */

const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

function pathOf(handler: unknown): string | undefined {
  return Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined;
}

function methodOf(handler: unknown): number | undefined {
  return Reflect.getMetadata(METHOD_METADATA, handler as object) as number | undefined;
}

const POST = 1;
const GET = 0;

function build() {
  const submit = { execute: jest.fn().mockResolvedValue({}) };
  const getMine = { execute: jest.fn().mockResolvedValue({}) };
  const getHistory = { execute: jest.fn().mockResolvedValue({}) };
  const requestUpload = { execute: jest.fn().mockResolvedValue({}) };
  const readDocument = { execute: jest.fn().mockResolvedValue({}) };

  const controller = new SkillEvidenceController(
    submit as never,
    getMine as never,
    getHistory as never,
    requestUpload as unknown as RequestEvidenceDocumentUploadPort,
    readDocument as unknown as ReadSkillEvidenceDocumentPort,
  );

  return { controller, requestUpload, readDocument };
}

const identity: RequestWithIdentity = {
  headers: {},
  user: { id: '11111111-1111-4111-8111-111111111111', role: 'student' },
};

describe('SkillEvidenceController document routes (FR-003)', () => {
  it('declares POST documents with the path the task names', () => {
    expect(pathOf(SkillEvidenceController.prototype.requestDocumentUpload)).toBe('documents');
    expect(methodOf(SkillEvidenceController.prototype.requestDocumentUpload)).toBe(POST);
  });

  it('declares GET :id/document for the reviewer read', () => {
    expect(pathOf(SkillEvidenceController.prototype.document)).toBe(':id/document');
    expect(methodOf(SkillEvidenceController.prototype.document)).toBe(GET);
  });

  it('declares the literal documents route before the parameterised :id route', () => {
    // Nest matches the routing table in class-body order. `POST documents` and `GET :id/document`
    // use different verbs so they cannot actually collide today — but registering the literal first
    // is the rule that keeps this true if a `POST :id/...` sibling is ever added.
    const order = Object.getOwnPropertyNames(SkillEvidenceController.prototype);
    expect(order.indexOf('requestDocumentUpload')).toBeGreaterThan(-1);
    expect(order.indexOf('requestDocumentUpload')).toBeLessThan(order.indexOf('document'));
  });

  it('passes the caller and their role to the reader, never an object key', async () => {
    const { controller, readDocument } = build();

    await controller.document('ev-1', {
      ...identity,
      user: { id: 'verifier-1', role: 'verifier' },
    });

    // The handler's only inputs are the id and the caller. There is deliberately no body or query
    // parameter through which a caller could name a different object in the bucket.
    expect(readDocument.execute).toHaveBeenCalledWith({
      evidenceId: 'ev-1',
      viewerId: 'verifier-1',
      viewerRole: 'verifier',
    });
  });

  it('builds the upload target for the caller, not for a body-supplied account', async () => {
    const { controller, requestUpload } = build();

    await controller.requestDocumentUpload(
      { fileName: 'cert.pdf', contentType: 'application/pdf', sizeBytes: 10 },
      identity,
    );

    expect(requestUpload.execute).toHaveBeenCalledWith({
      // The account comes from the token; a body field claiming another account would be ignored.
      accountId: '11111111-1111-4111-8111-111111111111',
      fileName: 'cert.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    });
  });
});
