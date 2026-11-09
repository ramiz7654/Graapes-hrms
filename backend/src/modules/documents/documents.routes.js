import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, logAudit } from '../../middleware/auth.js';

// backend/uploads/documents (git-ignored). Files are only reachable through the authenticated download route.
const UPLOAD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads/documents');
const MAX_BYTES = 5 * 1024 * 1024;
const CATEGORIES = ['RESUME', 'ID_PROOF', 'ADDRESS_PROOF', 'SIGNED_LETTER', 'CERTIFICATE', 'OTHER'];
const FILE_TYPES = {
  '.pdf': { mime: 'application/pdf', magic: [[0x25, 0x50, 0x44, 0x46]] },
  '.png': { mime: 'image/png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
  '.jpg': { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
  '.jpeg': { mime: 'image/jpeg', magic: [[0xff, 0xd8, 0xff]] },
  '.doc': { mime: 'application/msword', magic: [[0xd0, 0xcf, 0x11, 0xe0]] },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [[0x50, 0x4b, 0x03, 0x04]] },
};

/**
 * Who may see (and remove) a document, decided by the OWNER's role:
 *  - the owner always can
 *  - Super Admin can see everything
 *  - HR Admin can see Employee / Manager / Finance documents, but NOT another HR Admin's or the Super Admin's
 * Managers and employees only ever see their own.
 */
const PRIVATE_TO_SUPER_ADMIN = ['HR_ADMIN', 'SUPER_ADMIN'];
function canAccessDocument(user, ownerEmployeeId, ownerRole) {
  if (user.employee?.id && user.employee.id === ownerEmployeeId) return true;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'HR_ADMIN') return !PRIVATE_TO_SUPER_ADMIN.includes(ownerRole || 'EMPLOYEE');
  return false;
}
const DOCUMENT_INCLUDE = {
  employee: { select: { id: true, fullName: true, employeeCode: true, userAccount: { select: { role: true } } } },
};

export function documentsRouter() {
  const router = Router();

  // GET /api/documents            -> everything the signed-in user may see
  // GET /api/documents?employeeId= -> only that employee's documents (profile view)
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      const ownId = user.employee?.id || 'none';
      const employeeId = typeof req.query.employeeId === 'string' && req.query.employeeId ? req.query.employeeId : null;

      let where = { deletedAt: null };
      if (user.role === 'SUPER_ADMIN') {
        if (employeeId) where.employeeId = employeeId;
      } else if (user.role === 'HR_ADMIN') {
        where = {
          deletedAt: null,
          ...(employeeId ? { employeeId } : {}),
          OR: [{ employeeId: ownId }, { employee: { userAccount: { role: { notIn: PRIVATE_TO_SUPER_ADMIN } } } }],
        };
      } else {
        where.employeeId = ownId;
        if (employeeId && employeeId !== ownId) return res.json({ documents: [] });
      }

      const documents = await prisma.employeeDocument.findMany({ where, include: DOCUMENT_INCLUDE, orderBy: { createdAt: 'desc' } });

      return res.json({
        documents: documents.map((d) => ({
          id: d.id,
          employeeId: d.employeeId,
          employeeName: d.employee?.fullName,
          employeeCode: d.employee?.employeeCode,
          category: d.category,
          title: d.title,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt,
          canDelete: canAccessDocument(user, d.employeeId, d.employee?.userAccount?.role),
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // POST /api/documents: upload a file for the signed-in employee.
  // Body: { title, category, fileName, dataBase64 }  (browser reads the chosen file and sends it as base64).
  // Files are stored privately on the server disk (backend/uploads/documents) - never served statically.
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const employee = req.user.employee;
      if (!employee) {
        return res.status(400).json({ error: { code: 'NO_EMPLOYEE_RECORD', message: 'Documents can only be uploaded for an employee account.' } });
      }
      const { title, category, fileName, dataBase64 } = req.body || {};
      const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 160) : '';
      if (cleanTitle.length < 2) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a document title.' } });
      if (!CATEGORIES.includes(category)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Choose a document category.' } });
      if (typeof dataBase64 !== 'string' || !dataBase64) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Choose a file to upload.' } });

      const safeName = path.basename(String(fileName || 'document')).replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'document';
      const ext = path.extname(safeName).toLowerCase();
      const type = FILE_TYPES[ext];
      if (!type) return res.status(400).json({ error: { code: 'UNSUPPORTED_FILE', message: 'Only PDF, JPG, PNG, DOC and DOCX files are allowed.' } });

      const buffer = Buffer.from(dataBase64, 'base64');
      if (buffer.length === 0) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'The selected file is empty.' } });
      if (buffer.length > MAX_BYTES) return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'The file is larger than 5 MB.' } });
      if (!type.magic.some((sig) => buffer.subarray(0, sig.length).equals(Buffer.from(sig)))) {
        return res.status(400).json({ error: { code: 'UNSUPPORTED_FILE', message: `This file does not look like a real ${ext.slice(1).toUpperCase()} file.` } });
      }

      const storageKey = `${employee.id}/${crypto.randomUUID()}${ext}`;
      const target = path.join(UPLOAD_ROOT, storageKey);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer, { flag: 'wx' });

      let document;
      try {
        document = await prisma.employeeDocument.create({
          data: {
            employeeId: employee.id,
            category,
            title: cleanTitle,
            fileName: safeName,
            storageKey,
            mimeType: type.mime,
            sizeBytes: buffer.length,
            uploadedById: req.user.id,
          },
        });
      } catch (error) {
        await fs.rm(target, { force: true }); // never leave an orphan file behind
        throw error;
      }

      await logAudit(req, { action: 'DOCUMENT_UPLOADED', entityType: 'EmployeeDocument', entityId: document.id, after: { title: cleanTitle, category, fileName: safeName, sizeBytes: buffer.length } });
      return res.status(201).json({ message: 'Document uploaded.', document: { id: document.id, title: document.title, fileName: document.fileName, sizeBytes: document.sizeBytes } });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/documents/:id/download: owner, HR Admin or Super Admin only.
  router.get('/:id/download', requireAuth, async (req, res, next) => {
    try {
      const document = await prisma.employeeDocument.findFirst({ where: { id: req.params.id, deletedAt: null }, include: DOCUMENT_INCLUDE });
      if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
      if (!canAccessDocument(req.user, document.employeeId, document.employee?.userAccount?.role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this document.' } });
      }
      const file = path.resolve(UPLOAD_ROOT, document.storageKey);
      if (!file.startsWith(UPLOAD_ROOT + path.sep)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid document path.' } });
      try { await fs.access(file); } catch { return res.status(404).json({ error: { code: 'FILE_MISSING', message: 'The stored file could not be found.' } }); }
      res.setHeader('Content-Type', document.mimeType);
      return res.download(file, document.fileName);
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /api/documents/:id: the owner, or whoever may see it (see canAccessDocument).
  // The record is soft-deleted and the stored file is removed from disk.
  router.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const document = await prisma.employeeDocument.findFirst({ where: { id: req.params.id, deletedAt: null }, include: DOCUMENT_INCLUDE });
      if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
      if (!canAccessDocument(req.user, document.employeeId, document.employee?.userAccount?.role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot delete this document.' } });
      }
      await prisma.employeeDocument.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
      const file = path.resolve(UPLOAD_ROOT, document.storageKey);
      if (file.startsWith(UPLOAD_ROOT + path.sep)) await fs.rm(file, { force: true });
      await logAudit(req, { action: 'DOCUMENT_DELETED', entityType: 'EmployeeDocument', entityId: document.id, before: { title: document.title, fileName: document.fileName } });
      return res.json({ message: 'Document deleted.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

