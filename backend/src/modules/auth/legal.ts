import { LegalDocumentType } from '@prisma/client';

import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import { AppError } from '../../lib/app-error.js';

export async function currentLegalDocuments(database: DatabaseClient) {
  const documents = await database.legalDocument.findMany({ where: { isCurrent: true, type: { in: [LegalDocumentType.TERMS, LegalDocumentType.PRIVACY] } } });
  const terms = documents.find((document) => document.type === LegalDocumentType.TERMS);
  const privacy = documents.find((document) => document.type === LegalDocumentType.PRIVACY);
  if (!terms || !privacy) throw new AppError(503, 'LEGAL_DOCUMENTS_UNAVAILABLE', 'Registration is temporarily unavailable.');
  return [terms, privacy] as const;
}
