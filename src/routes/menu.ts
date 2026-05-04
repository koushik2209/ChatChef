import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { listMenu, createMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';

const router = Router();

router.use(authenticate);

router.get('/', listMenu);
router.post('/', createMenuItem);
router.patch('/:id', updateMenuItem);
router.delete('/:id', deleteMenuItem);

export default router;
