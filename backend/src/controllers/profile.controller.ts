import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';

const MAX_PROFILES = 5;
const publicProfileSelect = {
  id: true,
  name: true,
  avatar: true,
  isKids: true,
  pinHash: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeProfile<T extends { pinHash: string | null }>(profile: T) {
  const { pinHash, ...safe } = profile;
  return { ...safe, hasPin: Boolean(pinHash) };
}

function validatePin(pin: unknown) {
  return pin === undefined || pin === null || pin === '' || (typeof pin === 'string' && /^\d{4}$/.test(pin));
}

export const getProfiles = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    let profiles = await prisma.userProfile.findMany({
      where: { userId: req.user.id },
      select: publicProfileSelect,
      orderBy: { createdAt: 'asc' },
    });

    if (profiles.length === 0) {
      const profile = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.userProfile.findFirst({
          where: { userId: req.user!.id },
          select: publicProfileSelect,
          orderBy: { createdAt: 'asc' },
        });
        if (existing) return existing;

        const [favorites, watchlist, history] = await Promise.all([
          transaction.favorite.findMany({ where: { userId: req.user!.id }, select: { movieId: true, createdAt: true } }),
          transaction.watchlist.findMany({ where: { userId: req.user!.id }, select: { movieId: true, createdAt: true } }),
          transaction.watchHistory.findMany({ where: { userId: req.user!.id } }),
        ]);
        const created = await transaction.userProfile.create({
          data: { userId: req.user!.id, name: req.user!.username.slice(0, 30) || 'Mặc định' },
          select: publicProfileSelect,
        });
        await Promise.all([
          transaction.profileFavorite.createMany({ data: favorites.map((entry) => ({ profileId: created.id, ...entry })), skipDuplicates: true }),
          transaction.profileWatchlist.createMany({ data: watchlist.map((entry) => ({ profileId: created.id, ...entry })), skipDuplicates: true }),
          transaction.profileWatchHistory.createMany({
            data: history.map((entry) => ({
              profileId: created.id,
              movieId: entry.movieId,
              episodeId: entry.episodeId,
              watchedTime: entry.watchedTime,
              duration: entry.duration,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
            })),
            skipDuplicates: true,
          }),
        ]);
        return created;
      });
      profiles = [profile];
    }

    return res.json(profiles.map(serializeProfile));
  } catch (error) {
    return internalError(res, 'Không thể tải hồ sơ người xem.', error);
  }
};

export const createProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : null;
  const pin = req.body.pin;
  if (name.length < 1 || name.length > 30) return res.status(400).json({ message: 'Tên hồ sơ phải từ 1 đến 30 ký tự.' });
  if (!validatePin(pin)) return res.status(400).json({ message: 'Mã PIN phải gồm đúng 4 chữ số.' });

  try {
    const count = await prisma.userProfile.count({ where: { userId: req.user.id } });
    if (count >= MAX_PROFILES) return res.status(400).json({ message: `Mỗi tài khoản được tạo tối đa ${MAX_PROFILES} hồ sơ.` });
    const profile = await prisma.userProfile.create({
      data: {
        userId: req.user.id,
        name,
        avatar: avatar || null,
        isKids: Boolean(req.body.isKids),
        pinHash: pin ? await bcrypt.hash(pin, 10) : null,
      },
      select: publicProfileSelect,
    });
    return res.status(201).json(serializeProfile(profile));
  } catch (error) {
    return internalError(res, 'Không thể tạo hồ sơ người xem.', error);
  }
};

export const updateViewerProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { id } = req.params;
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const pin = req.body.pin;
  if (name !== undefined && (name.length < 1 || name.length > 30)) return res.status(400).json({ message: 'Tên hồ sơ phải từ 1 đến 30 ký tự.' });
  if (!validatePin(pin)) return res.status(400).json({ message: 'Mã PIN phải gồm đúng 4 chữ số.' });

  try {
    const existing = await prisma.userProfile.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    const profile = await prisma.userProfile.update({
      where: { id },
      data: {
        name,
        avatar: req.body.avatar === undefined ? undefined : (String(req.body.avatar).trim() || null),
        isKids: req.body.isKids === undefined ? undefined : Boolean(req.body.isKids),
        pinHash: pin === undefined ? undefined : (pin ? await bcrypt.hash(pin, 10) : null),
      },
      select: publicProfileSelect,
    });
    return res.json(serializeProfile(profile));
  } catch (error) {
    return internalError(res, 'Không thể cập nhật hồ sơ.', error);
  }
};

export const verifyProfilePin = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const profile = await prisma.userProfile.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!profile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    if (!profile.pinHash) return res.json({ valid: true });
    const valid = typeof req.body.pin === 'string' && await bcrypt.compare(req.body.pin, profile.pinHash);
    return valid ? res.json({ valid: true }) : res.status(403).json({ valid: false, message: 'Mã PIN không đúng.' });
  } catch (error) {
    return internalError(res, 'Không thể xác thực mã PIN.', error);
  }
};

export const deleteViewerProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    const profiles = await prisma.userProfile.findMany({ where: { userId: req.user.id }, select: { id: true } });
    if (profiles.length <= 1) return res.status(400).json({ message: 'Tài khoản phải giữ lại ít nhất một hồ sơ.' });
    if (!profiles.some((profile) => profile.id === req.params.id)) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    await prisma.userProfile.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Đã xóa hồ sơ.' });
  } catch (error) {
    return internalError(res, 'Không thể xóa hồ sơ.', error);
  }
};
