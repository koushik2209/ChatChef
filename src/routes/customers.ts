import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { listCustomers } from '../controllers/customersController';

const router = Router();

router.use(authenticate);
router.get('/', listCustomers);

export default router;
