import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';

export type RBACConfig = {
  [key: string]: {
    GET?: UserRole[];
    POST?: UserRole[];
    PUT?: UserRole[];
    DELETE?: UserRole[];
  };
};

// Default RBAC configuration
export const rbacConfig: RBACConfig = {
  '/api/vault/documents': {
    GET: ['ADMIN', 'LAWYER', 'PARALEGAL', 'CLIENT'],
    POST: ['ADMIN', 'LAWYER'],
  },
  '/api/vault/upload': {
    POST: ['ADMIN', 'LAWYER'],
  },
  '/api/vault/analyze': {
    POST: ['ADMIN', 'LAWYER', 'PARALEGAL'],
  },
  '/api/vault/update-sharing': {
    POST: ['ADMIN', 'LAWYER'],
  },
  '/api/vault/stats': {
    GET: ['ADMIN', 'LAWYER', 'PARALEGAL', 'CLIENT'],
  }
};

export function rbacMiddleware(config: RBACConfig = rbacConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip RBAC check if user is not authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.user;
    const path = req.path;
    const method = req.method;

    // Check if path has RBAC configuration
    const pathConfig = config[path];
    if (!pathConfig) {
      return next();
    }

    // Check if method is allowed for user's role
    const allowedRoles = pathConfig[method as keyof typeof pathConfig];
    if (!allowedRoles) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}