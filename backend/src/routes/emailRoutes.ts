import { Router } from 'express';
import multer from 'multer';
import { EmailController } from '../controllers/emailController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authMiddleware);

router.post('/schedule', upload.single('file'), EmailController.scheduleEmails);
router.get('/scheduled', EmailController.getScheduledEmails);
router.get('/sent', EmailController.getSentEmails);
router.post('/:id/cancel', EmailController.cancelEmail);
router.post('/:id/reschedule', EmailController.rescheduleEmail);
router.get('/senders', EmailController.getSenders);

export default router;
