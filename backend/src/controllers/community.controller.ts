import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';


// Comments
export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  const { movieId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { movieId, parentId: null }, // Top level comments
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
            commentLikes: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        commentLikes: true,
      },
    });

    // Check if the current user liked the comments
    const currentUserId = req.user?.id;
    const formattedComments = comments.map((comment) => {
      const isLiked = currentUserId
        ? comment.commentLikes.some((like) => like.userId === currentUserId)
        : false;

      const replies = comment.replies.map((reply) => ({
        ...reply,
        likesCount: reply.commentLikes.length,
        isLiked: currentUserId
          ? reply.commentLikes.some((like) => like.userId === currentUserId)
          : false,
      }));

      return {
        ...comment,
        likesCount: comment.commentLikes.length,
        isLiked,
        replies,
      };
    });

    return res.json(formattedComments);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving comments.', error: error.message });
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
    return res.status(500).json({ message: 'Error posting comment.', error: error.message });
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
    return res.status(500).json({ message: 'Error updating comment like.', error: error.message });
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
    return res.status(500).json({ message: 'Error deleting comment.', error: error.message });
  }
};

// Ratings
export const rateMovie = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId } = req.params;
  const { score } = req.body; // Scale 1 - 10

  const parsedScore = parseInt(score, 10);
  if (isNaN(parsedScore) || parsedScore < 1 || parsedScore > 10) {
    return res.status(400).json({ message: 'Score must be an integer between 1 and 10.' });
  }

  try {
    // 1. Create or update rating
    await prisma.rating.upsert({
      where: {
        movieId_userId: {
          movieId,
          userId: req.user.id,
        },
      },
      update: { score: parsedScore },
      create: {
        movieId,
        userId: req.user.id,
        score: parsedScore,
      },
    });

    // 2. Re-calculate movie ratingAvg
    const aggregate = await prisma.rating.aggregate({
      where: { movieId },
      _avg: { score: true },
    });

    const average = aggregate._avg.score ? parseFloat(aggregate._avg.score.toFixed(1)) : 0;

    await prisma.movie.update({
      where: { id: movieId },
      data: { ratingAvg: average },
    });

    return res.json({ message: 'Rating saved.', ratingAvg: average });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error rating movie.', error: error.message });
  }
};

// Reports
export const reportContent = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  const { movieId, commentId, type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ message: 'Type and content description are required.' });
  }

  try {
    const report = await prisma.report.create({
      data: {
        userId: req.user.id,
        movieId: movieId || null,
        commentId: commentId || null,
        type,
        content,
      },
    });

    return res.status(201).json({ message: 'Report submitted successfully.', report });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error reporting content.', error: error.message });
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
    return res.status(500).json({ message: 'Error retrieving user rating.', error: error.message });
  }
};
