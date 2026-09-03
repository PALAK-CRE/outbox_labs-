import { Router } from 'express';
import { StatsController } from '../controllers/statsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/dashboard', StatsController.getDashboardStats);

export default router;
