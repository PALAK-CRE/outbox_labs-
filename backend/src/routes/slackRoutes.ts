import { Router } from 'express';
import { SlackController } from '../controllers/slackController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/install', authMiddleware, SlackController.install);
router.get('/oauth_redirect', SlackController.oauthRedirect);
router.get('/status', authMiddleware, SlackController.getStatus);
router.post('/test-alert', authMiddleware, SlackController.testAlert);
router.post('/connect-webhook', authMiddleware, SlackController.connectWebhook);
router.post('/disconnect', authMiddleware, SlackController.disconnect);

export default router;
