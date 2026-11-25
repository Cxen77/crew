import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import dbConnect from './config/db.js';
import clubRoutes from './routes/clubs.js';
import eventRoutes from './routes/events.js';
import volunteerRoutes from './routes/volunteers.js';
import agentRoutes from './routes/agent.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'crew-sync-api', timestamp: new Date().toISOString() });
});

app.use('/api/clubs', clubRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(status).json({
    message: err.message || 'Internal Server Error',
  });
});

dbConnect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Crew Sync API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  });
