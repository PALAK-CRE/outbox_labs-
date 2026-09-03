import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/google', AuthController.googleLogin);
router.post('/demo', AuthController.demoLogin);
router.get('/me', authMiddleware, AuthController.getMe);

export default router;
