require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const depthLimit = require('graphql-depth-limit');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { getContextUser } = require('./auth/auth');
const calendarService = require('./services/googleCalendar');
const db = require('./db/pool');

const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

async function startServer() {
  const app = express();

  // ── Trust proxy (running behind nginx/Caddy) ──
  app.set('trust proxy', 1);

  // ── Security Headers ──
  app.use(helmet({
    contentSecurityPolicy: IS_PROD ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS – allow-list origins ──
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  // ── Rate Limiting ──
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PROD ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/graphql', apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PROD ? 20 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later.' },
  });
  app.use('/auth', authLimiter);

  // ── Health Check (with DB ping) ──
  app.get('/health', (_, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
  });

  // ── Google OAuth config for frontend ──
  app.get('/auth/google/client-id', (_, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured' });
    }
    return res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
  });

  // ── Google Calendar OAuth callback ──
  app.get('/auth/google/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) {
      return res.status(400).send('Missing code or state');
    }
    try {
      await calendarService.handleCallback(code, userId);
      res.redirect(`${ALLOWED_ORIGINS[0]}/settings?calendar=connected`);
    } catch (err) {
      console.error('Calendar OAuth callback error:', err);
      res.redirect(`${ALLOWED_ORIGINS[0]}/settings?calendar=error`);
    }
  });

  // ── Apollo GraphQL ──
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(7)],
    introspection: !IS_PROD,
    formatError: (formattedError, error) => {
      console.error('GraphQL Error:', error);
      // Never leak internal details in production
      if (IS_PROD && !formattedError.extensions?.code) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return {
        message: formattedError.message,
        extensions: { code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR' },
      };
    },
  });

  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const user = await getContextUser(req);
      return { user };
    },
  }));

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    console.log(`🔒 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`🔒 Introspection: ${IS_PROD ? 'DISABLED' : 'enabled (dev)'}`);
    console.log(`🔒 Rate limit: ${IS_PROD ? '300' : '1000'} req/15min`);
  });
}

startServer().catch(console.error);
