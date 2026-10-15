import { Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { isDbAvailable, prisma } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/authenticate.js';

export async function getSettingsOverview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    let userDetails = null;
    let githubIntegration = null;

    if (userId) {
      try {
        if (await isDbAvailable()) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { githubIntegration: true },
          });

          if (user) {
            userDetails = {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              createdAt: user.createdAt.toISOString(),
            };

            if (user.githubIntegration) {
              githubIntegration = {
                connected: true,
                username: user.githubIntegration.githubUsername,
                avatarUrl: user.githubIntegration.githubAvatarUrl,
                linkedAt: user.githubIntegration.createdAt.toISOString(),
                tokenMasked: '••••••••••••••••••••••••••••••••••••',
              };
            }
          }
        }
      } catch {
        // Fall back gracefully when database is unreachable in test/offline environment
      }
    }

    if (!userDetails) {
      userDetails = {
        id: userId || 'local-developer',
        name: 'DevWeave Developer',
        email: 'developer@devweave.internal',
        role: req.user?.role || 'DEVELOPER',
        createdAt: new Date().toISOString(),
      };
    }

    if (!githubIntegration) {
      githubIntegration = {
        connected: false,
        username: null,
        avatarUrl: null,
        linkedAt: null,
        tokenMasked: null,
      };
    }

    // Mask Jenkins token safely
    const rawJenkinsToken = env.JENKINS_API_TOKEN || '';
    const maskedJenkinsToken =
      rawJenkinsToken.length > 4
        ? '••••••••••••••••' + rawJenkinsToken.slice(-4)
        : '••••••••••••••••';

    // Mask database URL safely
    let maskedDbUrl = 'postgresql://postgres:••••••••@supabase.co:5432/postgres';
    try {
      const parsedUrl = new URL(env.DATABASE_URL);
      maskedDbUrl = `${parsedUrl.protocol}//${parsedUrl.username}:••••••••@${parsedUrl.host}${parsedUrl.pathname}`;
    } catch {
      maskedDbUrl = 'postgresql://[masked_credentials]@postgres:5432/devweave';
    }

    res.status(200).json({
      success: true,
      data: {
        user: userDetails,
        integrations: {
          github: {
            ...githubIntegration,
            clientIdMasked: env.GITHUB_CLIENT_ID.substring(0, 6) + '••••••••••••••••',
            callbackUrl: env.GITHUB_CALLBACK_URL,
          },
          jenkins: {
            url: env.JENKINS_URL,
            username: env.JENKINS_USERNAME || 'admin',
            tokenMasked: maskedJenkinsToken,
            defaultJob: env.JENKINS_JOB_NAME,
          },
          database: {
            type: 'PostgreSQL (Supabase Hosted)',
            connectionStringMasked: maskedDbUrl,
            pooling: 'Transaction Pooler (Port 5432 / 6543)',
          },
        },
        environment: {
          nodeEnv: env.NODE_ENV,
          port: env.PORT,
          frontendUrl: env.FRONTEND_URL,
          jwtExpiresIn: env.JWT_EXPIRES_IN,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
