import { Router } from 'express';
import { SearchController } from '../controllers/searchController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', SearchController.search);

export default router;
