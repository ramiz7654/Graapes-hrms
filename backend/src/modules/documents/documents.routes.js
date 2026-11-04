import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, logAudit } from '../../middleware/auth.js';

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

  // Uploads are intentionally disabled until a real private object-storage provider is configured.
  // Never create fake document records with invented MIME types or file sizes.
  router.post('/', requireAuth, async (_req, res) => {
    return res.status(503).json({
      error: {
        code: 'DOCUMENT_STORAGE_NOT_CONFIGURED',
        message: 'Document upload is not available because secure file storage has not been configured. No document record was created.',
      },
    });
  });

  return router;
}

