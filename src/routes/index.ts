import { Router } from 'express';
import prisma from '../models/prisma';
import webhookRouter from './webhook';
import authRouter from './auth';
import ordersRouter from './orders';
import menuRouter from './menu';
import customersRouter from './customers';
import paymentsRouter from './payments';
import dashboardRouter from './dashboard';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ChatChef API is running' });
});

router.get('/seed', async (_req, res) => {
  const seller = await prisma.seller.upsert({
    where: { whatsapp_number: '15551571828' },
    update: {},
    create: { name: 'Priya Home Kitchen', whatsapp_number: '15551571828', upi_id: 'priya@upi', slug: 'test1', is_active: true },
  });
  res.json({ success: true, data: seller });
});

router.use('/webhook', webhookRouter);
router.use('/auth', authRouter);
router.use('/orders', ordersRouter);
router.use('/menu', menuRouter);
router.use('/customers', customersRouter);
router.use('/payments', paymentsRouter);
router.use('/dashboard', dashboardRouter);

export default router;
