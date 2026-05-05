import { Router } from 'express';
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

router.use('/webhook', webhookRouter);
router.use('/auth', authRouter);
router.use('/orders', ordersRouter);
router.use('/menu', menuRouter);
router.use('/customers', customersRouter);
router.use('/payments', paymentsRouter);
router.use('/dashboard', dashboardRouter);

export default router;
