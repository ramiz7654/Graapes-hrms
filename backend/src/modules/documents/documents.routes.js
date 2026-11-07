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

export function documentsRouter() {
  const router = Router();

  // GET /api/documents
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const { user } = req;
      let whereClause = {};

      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
        whereClause = { deletedAt: null };
      } else {
        whereClause = {
          employeeId: user.employee?.id || 'none',
          deletedAt: null,
        };
      }

      const documents = await prisma.employeeDocument.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { id: true, fullName: true, employeeCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

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
      const document = await prisma.employeeDocument.findFirst({ where: { id: req.params.id, deletedAt: null } });
      if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);
      if (!isAdmin && document.employeeId !== req.user.employee?.id) {
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

  return router;
}

