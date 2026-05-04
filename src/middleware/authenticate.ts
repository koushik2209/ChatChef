import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/prisma';

interface JwtPayload {
  sellerId: string;
  phone: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'changeme') as JwtPayload;
    const seller = await prisma.seller.findUnique({ where: { id: payload.sellerId } });

    if (!seller || !seller.is_active) {
      res.status(401).json({ success: false, message: 'Seller not found or inactive' });
      return;
    }

    req.seller = seller;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
