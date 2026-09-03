import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { AuthenticatedUser } from '../types/index.js';
import { prisma } from '../config/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch (err) {
      // Invalid token, continue to fallback or reject
    }
  }

  // Fallback: If no token or demo mode, retrieve or create default demo user
  try {
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo.user@reachinbox.ai' },
      update: {},
      create: {
        email: 'demo.user@reachinbox.ai',
        name: 'ReachInbox Demo User',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
    });

    req.user = {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      avatarUrl: demoUser.avatarUrl,
    };
    return next();
  } catch (dbError) {
    req.user = {
      id: 'demo-user-id-001',
      email: 'demo.user@reachinbox.ai',
      name: 'ReachInbox Demo User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
    return next();
  }
}
