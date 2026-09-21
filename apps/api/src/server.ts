import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { closeRedis } from './config/redis.js';

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet');
  }
  return ioInstance;
}

export async function startServer(): Promise<{ app: ReturnType<typeof createApp>; server: http.Server; io: SocketIOServer }> {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
  });

  ioInstance = io;

  // Real-time department room subscription
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket client connected');

    socket.on('join_department', (data: { facilityId: string; departmentId: string }) => {
      if (data?.facilityId && data?.departmentId) {
        const room = `dept:${data.facilityId}:${data.departmentId}`;
        socket.join(room);
        logger.debug({ socketId: socket.id, room }, 'Socket joined department room');
      }
    });

    socket.on('leave_department', (data: { facilityId: string; departmentId: string }) => {
      if (data?.facilityId && data?.departmentId) {
        const room = `dept:${data.facilityId}:${data.departmentId}`;
        socket.leave(room);
        logger.debug({ socketId: socket.id, room }, 'Socket left department room');
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket client disconnected');
    });
  });

  server.listen(env.PORT, () => {
    logger.info(`🚀 Simulated EHR API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Gracefully shutting down server');
    server.close(async () => {
      await disconnectDB();
      await closeRedis();
      logger.info('Server and connections successfully closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, server, io };
}

// Direct execution entrypoint
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.fatal({ err }, 'Failed to start EHR API server');
    process.exit(1);
  });
}
