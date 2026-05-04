import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { listOrders, updateOrderStatus, cookingSummary } from '../controllers/ordersController';

const router = Router();

router.use(authenticate);

// cooking-summary MUST come before /:id to avoid Express matching it as an id param
router.get('/cooking-summary', cookingSummary);
router.get('/', listOrders);
router.patch('/:id/status', updateOrderStatus);

export default router;
