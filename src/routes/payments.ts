import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { listPayments, markPaid } from '../controllers/paymentsController';

const router = Router();

router.use(authenticate);
router.get('/', listPayments);
router.patch('/:orderId/mark-paid', markPaid);

export default router;
