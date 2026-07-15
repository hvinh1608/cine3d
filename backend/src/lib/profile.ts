import { prisma } from './prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getOwnedProfileId(req: AuthenticatedRequest): Promise<string | undefined> {
  const requestedId = req.header('x-profile-id')?.trim();
  if (!requestedId || !req.user) return undefined;

  const profile = await prisma.userProfile.findFirst({
    where: { id: requestedId, userId: req.user.id },
    select: { id: true },
  });
  return profile?.id;
}

export function hasRequestedProfile(req: AuthenticatedRequest) {
  return Boolean(req.header('x-profile-id')?.trim());
}
