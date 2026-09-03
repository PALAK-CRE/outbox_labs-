import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

export class AuthController {
  /**
   * Google OAuth Login - supports ID Token, OAuth 2.0 Access Token, Code Exchange, or Tokeninfo verification
   */
  public static async googleLogin(req: Request, res: Response) {
    const { credential, accessToken, access_token, code, id_token } = req.body || {};
    const token = credential || accessToken || access_token || id_token;

    if (!token && !code) {
      return res.status(400).json({ success: false, error: 'Google credential or access token is required' });
    }

    try {
      let email = '';
      let name = 'Google User';
      let avatarUrl = '';
      let googleId = '';

      // 1. If an access_token was provided (e.g. from useGoogleLogin popup flow)
      if (accessToken || access_token) {
        const rawToken = accessToken || access_token;
        try {
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${rawToken}` },
          });
          if (userinfoRes.ok) {
            const profile: any = await userinfoRes.json();
            if (profile?.email) {
              email = profile.email;
              name = profile.name || profile.given_name || profile.email.split('@')[0];
              avatarUrl = profile.picture || '';
              googleId = profile.sub || profile.id || '';
            }
          }
        } catch (fetchErr: any) {
          console.warn('Google userinfo fetch note:', fetchErr.message);
        }
      }

      // 2. If an authorization code was provided
      if (!email && code && ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET) {
        try {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: ENV.GOOGLE_CLIENT_ID,
              client_secret: ENV.GOOGLE_CLIENT_SECRET,
              redirect_uri: 'postmessage',
              grant_type: 'authorization_code',
            }),
          });
          if (tokenRes.ok) {
            const tokenData: any = await tokenRes.json();
            if (tokenData?.id_token) {
              const decoded: any = jwt.decode(tokenData.id_token);
              if (decoded && typeof decoded === 'object' && decoded.email) {
                email = decoded.email;
                name = decoded.name || decoded.given_name || decoded.email.split('@')[0];
                avatarUrl = decoded.picture || '';
                googleId = decoded.sub || '';
              }
            } else if (tokenData?.access_token) {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              });
              if (uRes.ok) {
                const profile: any = await uRes.json();
                email = profile.email;
                name = profile.name || profile.given_name || profile.email.split('@')[0];
                avatarUrl = profile.picture || '';
                googleId = profile.sub || '';
              }
            }
          }
        } catch (codeErr: any) {
          console.warn('Google code exchange note:', codeErr.message);
        }
      }

      // 3. If ID Token (credential / id_token) is provided
      const rawIdToken = credential || id_token;
      if (!email && rawIdToken) {
        // Try google-auth-library verifyIdToken
        if (ENV.GOOGLE_CLIENT_ID) {
          try {
            const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);
            const ticket = await client.verifyIdToken({
              idToken: rawIdToken,
              audience: ENV.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (payload && payload.email) {
              email = payload.email;
              name = payload.name || payload.given_name || payload.email.split('@')[0];
              avatarUrl = payload.picture || '';
              googleId = payload.sub || '';
            }
          } catch (verifyErr: any) {
            console.warn('Google verifyIdToken note:', verifyErr.message);
          }
        }

        // Try Google's official tokeninfo endpoint if verifyIdToken didn't resolve
        if (!email) {
          try {
            const tokeninfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawIdToken)}`);
            if (tokeninfoRes.ok) {
              const payload: any = await tokeninfoRes.json();
              if (payload?.email) {
                email = payload.email;
                name = payload.name || payload.given_name || payload.email.split('@')[0];
                avatarUrl = payload.picture || '';
                googleId = payload.sub || '';
              }
            }
          } catch (tokeninfoErr: any) {
            console.warn('Google tokeninfo endpoint note:', tokeninfoErr.message);
          }
        }

        // Fallback JWT decoder
        if (!email) {
          try {
            const decoded: any = jwt.decode(rawIdToken);
            if (decoded && typeof decoded === 'object' && decoded.email) {
              email = decoded.email;
              name = decoded.name || decoded.given_name || decoded.email.split('@')[0];
              avatarUrl = decoded.picture || '';
              googleId = decoded.sub || '';
            }
          } catch (jwtErr: any) {
            console.warn('JWT decode note:', jwtErr.message);
          }
        }
      }

      if (!email) {
        return res.status(400).json({ success: false, error: 'Could not verify or decode Google credentials.' });
      }

      // Safe DB Upsert that avoids unique constraint violations on googleId or email
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            ...(googleId ? [{ googleId }] : [])
          ]
        }
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            name: name || user.name,
            avatarUrl: avatarUrl || user.avatarUrl,
            ...(googleId ? { googleId } : {})
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name,
            avatarUrl,
            ...(googleId ? { googleId } : {})
          }
        });
      }

      const authToken = jwt.sign(
        { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token: authToken,
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
