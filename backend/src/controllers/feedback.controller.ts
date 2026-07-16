import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';

const categories = new Set(['GENERAL', 'MOVIE_REQUEST', 'FEATURE', 'WEBSITE_ERROR', 'VIP_SUPPORT', 'COPYRIGHT']);
const statuses = new Set(['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED']);

export const createFeedback = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const category = typeof req.body.category === 'string' ? req.body.category.trim().toUpperCase() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!categories.has(category)) return res.status(400).json({ message: 'Danh mục góp ý không hợp lệ.' });
  if (subject.length < 5 || subject.length > 120) return res.status(400).json({ message: 'Tiêu đề phải có từ 5 đến 120 ký tự.' });
  if (content.length < 10 || content.length > 3000) return res.status(400).json({ message: 'Nội dung phải có từ 10 đến 3000 ký tự.' });
  try {
    const feedback = await prisma.feedback.create({ data: { userId: req.user.id, category, subject, content } });
    return res.status(201).json({ message: 'Đã gửi góp ý. Cảm ơn bạn đã giúp CINE3D tốt hơn!', feedback });
  } catch (error) { return internalError(res, 'Không thể gửi góp ý.', error); }
};

export const getMyFeedback = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  try {
    return res.json(await prisma.feedback.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 }));
  } catch (error) { return internalError(res, 'Không thể tải góp ý.', error); }
};

export const getAdminFeedback = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json(await prisma.feedback.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200, include: { user: { select: { username: true, email: true } } } }));
  } catch (error) { return internalError(res, 'Không thể tải danh sách góp ý.', error); }
};

export const updateFeedback = async (req: AuthenticatedRequest, res: Response) => {
  const status = typeof req.body.status === 'string' ? req.body.status.trim().toUpperCase() : '';
  const adminReply = typeof req.body.adminReply === 'string' ? req.body.adminReply.trim() : '';
  if (!statuses.has(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
  if (adminReply.length > 2000) return res.status(400).json({ message: 'Phản hồi không được vượt quá 2000 ký tự.' });
  try {
    const feedback = await prisma.feedback.update({ where: { id: req.params.id }, data: { status, adminReply: adminReply || null, repliedAt: adminReply ? new Date() : null } });
    return res.json({ message: 'Đã cập nhật góp ý.', feedback });
  } catch (error) { return internalError(res, 'Không thể cập nhật góp ý.', error); }
};
