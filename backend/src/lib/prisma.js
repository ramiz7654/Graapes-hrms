import { PrismaClient } from '@prisma/client';

// One shared client for the whole API process.
export const prisma = new PrismaClient();
