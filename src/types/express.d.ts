import { Seller } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    seller?: Seller;
  }
}
