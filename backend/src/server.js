import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp({ checkDb: () => prisma.$queryRaw`SELECT 1` });

const port = process.env.PORT || env.API_PORT;
const server = app.listen(port, () => {
  console.log(`Graapes HRMS API listening on port ${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
