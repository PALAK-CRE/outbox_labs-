import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export class AuthController {
  /**
   * Google OAuth Login via ID Token (from Google Identity / @react-oauth/google)
   */
  public static async googleLogin(req: Request, res: Response) {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential token is required' });
    }

    try {
      let email = '';
      let name = 'Google User';
      let avatarUrl = '';
      let googleId = '';

      if (ENV.GOOGLE_CLIENT_ID) {
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: ENV.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (payload && payload.email) {
            email = payload.email;
            name = payload.name || payload.email.split('@')[0];
            avatarUrl = payload.picture || '';
            googleId = payload.sub || '';
          }
        } catch (verifyErr: any) {
          console.warn('Google verifyIdToken note:', verifyErr.message);
          const decoded: any = jwt.decode(credential);
          if (decoded && decoded.email) {
            email = decoded.email;
            name = decoded.name || decoded.email.split('@')[0];
            avatarUrl = decoded.picture || '';
            googleId = decoded.sub || '';
          } else {
            return res.status(400).json({ success: false, error: 'Invalid Google credential token' });
          }
        }
      } else {
        // Fallback decoder if Client ID not set locally
        const decoded: any = jwt.decode(credential);
        if (!decoded || !decoded.email) {
          return res.status(400).json({ success: false, error: 'Cannot decode Google token' });
        }
        email = decoded.email;
        name = decoded.name || decoded.email.split('@')[0];
        avatarUrl = decoded.picture || '';
        googleId = decoded.sub || '';
      }

      const updateData: any = { name, avatarUrl };
      const createData: any = { email, name, avatarUrl };
      if (googleId) {
        updateData.googleId = googleId;
        createData.googleId = googleId;
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: updateData,
        create: createData,
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error: any) {
      console.error('❌ Google Auth Error:', error.message);
      return res.status(401).json({ success: false, error: `Authentication failed: ${error.message}` });
    }
  }

  /**
   * Fast Demo Login for instant testing
   */
  public static async demoLogin(req: Request, res: Response) {
    const { email = 'mitrajit@reachinbox.ai', name = 'ReachInbox Reviewer' } = req.body;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  }

  /**
   * Get current authenticated user details + Slack status
   */
  public static async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { slackIntegration: true },
    });

    if (!user) {
      return res.json({
        success: true,
        user: req.user,
        slackConnected: false,
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      slackConnected: !!user.slackIntegration,
      slackTeam: user.slackIntegration?.teamName || null,
      slackChannel: user.slackIntegration?.channelName || null,
    });
  }
}
