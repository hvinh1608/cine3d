import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET must be set in environment variables.');
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

type AccessTokenPayload = jwt.JwtPayload & {
  id: string;
  email: string;
  username: string;
  role: string;
};

export function decodeAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_ACCESS_SECRET!);
  if (
    typeof decoded === 'string' ||
    typeof decoded.id !== 'string' ||
    typeof decoded.email !== 'string' ||
    typeof decoded.username !== 'string' ||
    typeof decoded.role !== 'string'
  ) {
    throw new Error('Invalid access token payload.');
  }
  return decoded as AccessTokenPayload;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  let decoded: AccessTokenPayload;
  try {
    decoded = decodeAccessToken(token);
  } catch {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, isLocked: true, role: { select: { name: true } } },
    });
    if (!user || user.isLocked) {
      return res.status(403).json({ message: 'Account is unavailable or locked.' });
    }
    req.user = { id: user.id, email: user.email, username: user.username, role: user.role.name };
    next();
  } catch (error) {
    console.error('Authentication database lookup failed.', error);
    return res.status(503).json({ message: 'Authentication service is temporarily unavailable.' });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

/** Attach user if a valid token is present; otherwise continue as guest. */
export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = decodeAccessToken(token);
    req.user = decoded;
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
};
