import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import { initDb, dbMode } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import tenantRoutes from './routes/tenants.js';
import contractRoutes from './routes/contracts.js';
import feeRoutes from './routes/fees.js';
import readingRoutes from './routes/readings.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import incidentRoutes from './routes/incidents.js';
import notificationRoutes from './routes/notifications.js';
import statsRoutes from './routes/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: dbMode }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Không tìm thấy API' }));

// Phục vụ bản build frontend (nếu có) để chạy 1 cổng duy nhất
const dist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

await initDb();
await seedIfEmpty();
app.listen(PORT, () => {
  console.log(`🏠 API quản lý Nhà 57 Giảng Võ chạy tại http://localhost:${PORT} (CSDL: ${dbMode})`);
});
