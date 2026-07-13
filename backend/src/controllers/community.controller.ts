import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { internalError } from '../lib/http-error';


// Comments
export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  const { movieId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { movieId, parentId: null }, // Top level comments
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
            commentLikes: { select: { userId: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
        commentLikes: { select: { userId: true } },
      },
    });

    // Check if the current user liked the comments
    const currentUserId = req.user?.id;
    const formattedComments = comments.map((comment) => {
      const isLiked = currentUserId
        ? comment.commentLikes.some((like) => like.userId === currentUserId)
        : false;

      const replies = comment.replies.map((reply) => {
        const { commentLikes, ...replyData } = reply;
        return {
          ...replyData,
          likesCount: commentLikes.length,
          isLiked: currentUserId ? commentLikes.some((like) => like.userId === currentUserId) : false,
        };
      });

      const { commentLikes, replies: _rawReplies, ...commentData } = comment;

      return {
        ...commentData,
        likesCount: commentLikes.length,
        isLiked,
        replies,
      };
    });

    return res.json(formattedComments);
  } catch (error: any) {
    return internalError(res, 'Error retrieving comments.', error);
  }
};

export const createComment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId } = req.params;
  const { content, parentId } = req.body;

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'Comment content is required.' });
  }
  if (content.trim().length > 2000) {
    return res.status(400).json({ message: 'Comment must not exceed 2000 characters.' });
  }

  try {
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, movieId, parentId: null },
        select: { id: true },
      });
      if (!parent) return res.status(400).json({ message: 'Reply parent must belong to the same movie.' });
    }

    const comment = await prisma.comment.create({
      data: {
        movieId,
        userId: req.user.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return res.status(201).json(comment);
  } catch (error: any) {
    return internalError(res, 'Error posting comment.', error);
  }
};

export const toggleLikeComment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { commentId } = req.params;

  try {
    const existing = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: req.user.id,
        },
      },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      return res.json({ liked: false, message: 'Unliked comment.' });
    } else {
      await prisma.commentLike.create({
        data: {
          commentId,
          userId: req.user.id,
        },
      });
      return res.json({ liked: true, message: 'Liked comment.' });
    }
  } catch (error: any) {
    return internalError(res, 'Error updating comment like.', error);
  }
};

export const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { commentId } = req.params;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    if (comment.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return res.json({ message: 'Comment deleted successfully.' });
  } catch (error: any) {
    return internalError(res, 'Error deleting comment.', error);
  }
};

// Ratings
export const rateMovie = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId } = req.params;
  const { score } = req.body; // Scale 1 - 10

  const parsedScore = Number(score);
  if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 10) {
    return res.status(400).json({ message: 'Score must be an integer between 1 and 10.' });
  }

  try {
    // 1. Create or update rating
    const average = await prisma.$transaction(async (tx) => {
      await tx.rating.upsert({
        where: {
          movieId_userId: {
            movieId,
            userId: req.user!.id,
          },
        },
        update: { score: parsedScore },
        create: { movieId, userId: req.user!.id, score: parsedScore },
      });
      const aggregate = await tx.rating.aggregate({ where: { movieId }, _avg: { score: true } });
      const nextAverage = aggregate._avg.score ? Number(aggregate._avg.score.toFixed(1)) : 0;
      await tx.movie.update({ where: { id: movieId }, data: { ratingAvg: nextAverage } });
      return nextAverage;
    });

    return res.json({ message: 'Rating saved.', ratingAvg: average });
  } catch (error: any) {
    return internalError(res, 'Error rating movie.', error);
  }
};

// Reports
export const reportContent = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId, commentId, type, content } = req.body;

  const normalizedType = typeof type === 'string' ? type.trim() : '';
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  if (!normalizedType || !normalizedContent) {
    return res.status(400).json({ message: 'Type and content description are required.' });
  }
  if (normalizedType.length > 50 || normalizedContent.length > 2000) {
    return res.status(400).json({ message: 'Report type or content is too long.' });
  }

  try {
    const report = await prisma.report.create({
      data: {
        userId: req.user.id,
        movieId: movieId || null,
        commentId: commentId || null,
        type: normalizedType,
        content: normalizedContent,
      },
    });

    return res.status(201).json({ message: 'Report submitted successfully.', report });
  } catch (error: any) {
    return internalError(res, 'Error reporting content.', error);
  }
};
export const getMovieRatingByUser = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId } = req.params;

  try {
    const rating = await prisma.rating.findUnique({
      where: {
        movieId_userId: {
          movieId,
          userId: req.user.id,
        },
      },
    });

    return res.json({ score: rating ? rating.score : null });
  } catch (error: any) {
    return internalError(res, 'Error retrieving user rating.', error);
  }
};
