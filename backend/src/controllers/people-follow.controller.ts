import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { internalError } from '../lib/http-error';

const config = {
  actor: { entity: prisma.actor, follow: prisma.actorFollow, idField: 'actorId' },
  director: { entity: prisma.director, follow: prisma.directorFollow, idField: 'directorId' },
} as const;

export const getPeopleFollowStatus = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const kind = req.params.kind as keyof typeof config;
  if (!config[kind]) return res.status(400).json({ message: 'Loại nghệ sĩ không hợp lệ.' });
  try {
    const where = kind === 'actor' ? { userId_actorId: { userId: req.user.id, actorId: req.params.id } } : { userId_directorId: { userId: req.user.id, directorId: req.params.id } };
    const follow = kind === 'actor' ? await prisma.actorFollow.findUnique({ where: where as any }) : await prisma.directorFollow.findUnique({ where: where as any });
    return res.json({ following: Boolean(follow) });
  } catch (error) { return internalError(res, 'Không thể tải trạng thái theo dõi.', error); }
};

export const togglePeopleFollow = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const kind = req.params.kind as keyof typeof config;
  if (!config[kind]) return res.status(400).json({ message: 'Loại nghệ sĩ không hợp lệ.' });
  try {
    if (kind === 'actor') {
      const entity = await prisma.actor.findUnique({ where: { id: req.params.id } });
      if (!entity) return res.status(404).json({ message: 'Không tìm thấy diễn viên.' });
      const where = { userId_actorId: { userId: req.user.id, actorId: entity.id } };
      const existing = await prisma.actorFollow.findUnique({ where });
      if (existing) { await prisma.actorFollow.delete({ where: { id: existing.id } }); return res.json({ following: false }); }
      await prisma.actorFollow.create({ data: { userId: req.user.id, actorId: entity.id } });
    } else {
      const entity = await prisma.director.findUnique({ where: { id: req.params.id } });
      if (!entity) return res.status(404).json({ message: 'Không tìm thấy đạo diễn.' });
      const where = { userId_directorId: { userId: req.user.id, directorId: entity.id } };
      const existing = await prisma.directorFollow.findUnique({ where });
      if (existing) { await prisma.directorFollow.delete({ where: { id: existing.id } }); return res.json({ following: false }); }
      await prisma.directorFollow.create({ data: { userId: req.user.id, directorId: entity.id } });
    }
    return res.json({ following: true });
  } catch (error) { return internalError(res, 'Không thể cập nhật theo dõi.', error); }
};
