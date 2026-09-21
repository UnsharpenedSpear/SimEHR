import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let io: SocketIOServer | null = null;

export interface SocketUser {
  id: string;
  email: string;
  roles: string[];
  departmentIds?: string[];
  facilityIds?: string[];
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
  });

  // JWT Authentication Middleware for WebSockets
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch (err) {
      logger.warn({ err }, 'WebSocket authentication failed');
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    logger.info({ userId: user.id }, 'WebSocket client connected');

    // Auto-join user room
    socket.join(`user:${user.id}`);

    // Join facility rooms
    if (user.facilityIds) {
      user.facilityIds.forEach((facId) => socket.join(`facility:${facId}`));
    }

    // Join department rooms
    if (user.departmentIds) {
      user.departmentIds.forEach((deptId) => socket.join(`dept:${deptId}`));
    }

    // Dynamic Room Subscription
    socket.on('join:patient', (patientId: string) => {
      socket.join(`patient:${patientId}`);
    });

    socket.on('leave:patient', (patientId: string) => {
      socket.leave(`patient:${patientId}`);
    });

    socket.on('join:dept', (deptId: string) => {
      socket.join(`dept:${deptId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ userId: user.id }, 'WebSocket client disconnected');
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function emitDispatchCreated(dispatch: any): void {
  if (!io) return;
  const payload = { event: 'DISPATCH_CREATED', data: dispatch };
  if (dispatch.toDeptId) io.to(`dept:${dispatch.toDeptId.toString()}`).emit('dispatch:new', payload);
  if (dispatch.fromDeptId) io.to(`dept:${dispatch.fromDeptId.toString()}`).emit('dispatch:new', payload);
  if (dispatch.facilityId) io.to(`facility:${dispatch.facilityId.toString()}`).emit('dispatch:new', payload);
  if (dispatch.patientId) io.to(`patient:${dispatch.patientId.toString()}`).emit('dispatch:new', payload);
}

export function emitDispatchTransitioned(dispatch: any): void {
  if (!io) return;
  const payload = { event: 'DISPATCH_UPDATED', data: dispatch };
  if (dispatch.toDeptId) io.to(`dept:${dispatch.toDeptId.toString()}`).emit('dispatch:updated', payload);
  if (dispatch.fromDeptId) io.to(`dept:${dispatch.fromDeptId.toString()}`).emit('dispatch:updated', payload);
  if (dispatch.patientId) io.to(`patient:${dispatch.patientId.toString()}`).emit('dispatch:updated', payload);
}

export function emitCriticalLabAlert(labResult: any): void {
  if (!io) return;
  const payload = { event: 'CRITICAL_LAB_ALERT', data: labResult };
  if (labResult.patientId) io.to(`patient:${labResult.patientId.toString()}`).emit('lab:critical', payload);
}
