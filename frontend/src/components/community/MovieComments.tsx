'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Crown, Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

type CommentItem = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  user: { username: string; avatar?: string | null; isVip?: boolean };
  replies?: CommentItem[];
};

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';

export default function MovieComments({ movieId }: { movieId: string }) {
  const { user, showToast } = useStore();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/movies/${movieId}/comments`)
      .then((response) => {
        if (active) setComments(response.data);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [movieId, user?.id]);

  const postComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để bình luận.', 'info');
      return;
    }
    const value = content.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/movies/${movieId}/comments`, { content: value });
      setComments((current) => [{ ...response.data, likesCount: 0, isLiked: false, replies: [] }, ...current]);
      setContent('');
    } catch {
      showToast('Không thể đăng bình luận. Vui lòng thử lại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const postReply = async (event: FormEvent, parentId: string) => {
    event.preventDefault();
    const value = replyContent.trim();
    if (!user || !value || submitting) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/movies/${movieId}/comments`, { content: value, parentId });
      setComments((current) => current.map((comment) => comment.id === parentId
        ? { ...comment, replies: [...(comment.replies || []), { ...response.data, likesCount: 0, isLiked: false }] }
        : comment));
      setReplyContent('');
      setReplyingTo(null);
    } catch {
      showToast('Không thể gửi phản hồi.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thích bình luận.', 'info');
      return;
    }
    try {
      const response = await api.post(`/comments/${commentId}/like`);
      const update = (item: CommentItem): CommentItem => item.id === commentId
        ? { ...item, isLiked: response.data.liked, likesCount: Math.max(0, item.likesCount + (response.data.liked ? 1 : -1)) }
        : { ...item, replies: item.replies?.map(update) };
      setComments((current) => current.map(update));
    } catch {
      showToast('Không thể cập nhật lượt thích.', 'error');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((current) => current
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({ ...comment, replies: comment.replies?.filter((reply) => reply.id !== commentId) })));
    } catch {
      showToast('Không thể xóa bình luận.', 'error');
    }
  };

  const actions = (comment: CommentItem, canReply: boolean) => (
    <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
      <button type="button" onClick={() => void toggleLike(comment.id)} className={`flex items-center gap-1 transition hover:text-red-400 ${comment.isLiked ? 'text-red-400' : ''}`}>
        <Heart className={`h-3.5 w-3.5 ${comment.isLiked ? 'fill-current' : ''}`} /> {comment.likesCount || 0}
      </button>
      {canReply && user && <button type="button" onClick={() => { setReplyingTo(comment.id); setReplyContent(''); }} className="transition hover:text-white">Trả lời</button>}
      {user && (user.id === comment.userId || user.role === 'ADMIN') && (
        <button type="button" onClick={() => void deleteComment(comment.id)} className="flex items-center gap-1 transition hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Xóa</button>
      )}
    </div>
  );

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left shadow-2xl backdrop-blur md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-white"><MessageCircle className="h-5 w-5 text-red-500" /> Bình luận</h2>
        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-400">{comments.length} thảo luận</span>
      </div>

      {user ? (
        <form onSubmit={postComment} className="mb-7 flex gap-3">
          <Image src={user.avatar || fallbackAvatar} alt={user.username} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="flex min-w-0 flex-1 gap-2 rounded-xl border border-white/10 bg-slate-900 p-2 focus-within:border-red-500/50">
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={2} placeholder="Chia sẻ cảm nhận về bộ phim..." className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-600" />
            <button disabled={!content.trim() || submitting} className="self-end rounded-lg bg-red-600 p-2.5 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40" title="Gửi bình luận"><Send className="h-4 w-4" /></button>
          </div>
        </form>
      ) : (
        <div className="mb-7 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs text-slate-400">
          <Link href="/account" className="font-bold text-red-400 hover:text-red-300">Đăng nhập</Link> để tham gia bình luận.
        </div>
      )}

      {loading ? <p className="py-8 text-center text-xs text-slate-500">Đang tải bình luận...</p> : comments.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-500">Chưa có bình luận. Hãy là người đầu tiên chia sẻ cảm nhận.</p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <article key={comment.id} className="border-b border-white/5 pb-5 last:border-0 last:pb-0">
              <div className="flex gap-3">
                <Image src={comment.user.avatar || fallbackAvatar} alt={comment.user.username} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-200">{comment.user.username}</span>{comment.user.isVip && <span className="flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300"><Crown className="h-2.5 w-2.5" /> VIP</span>}<time className="text-[10px] text-slate-600">{new Date(comment.createdAt).toLocaleDateString('vi-VN')}</time></div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{comment.content}</p>
                  {actions(comment, true)}
                </div>
              </div>

              {replyingTo === comment.id && (
                <form onSubmit={(event) => void postReply(event, comment.id)} className="ml-12 mt-3 flex gap-2">
                  <input autoFocus value={replyContent} onChange={(event) => setReplyContent(event.target.value)} maxLength={2000} placeholder={`Phản hồi @${comment.user.username}...`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-red-500/50" />
                  <button disabled={!replyContent.trim() || submitting} className="rounded-lg bg-red-600 px-3 text-white disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setReplyingTo(null)} className="px-2 text-xs font-bold text-slate-500 hover:text-white">Hủy</button>
                </form>
              )}

              {!!comment.replies?.length && <div className="ml-8 mt-4 space-y-4 border-l border-white/10 pl-4 md:ml-12">{comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-3"><Image src={reply.user.avatar || fallbackAvatar} alt={reply.user.username} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-300">{reply.user.username}</span><time className="text-[9px] text-slate-600">{new Date(reply.createdAt).toLocaleDateString('vi-VN')}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">{reply.content}</p>{actions(reply, false)}</div></div>
              ))}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
