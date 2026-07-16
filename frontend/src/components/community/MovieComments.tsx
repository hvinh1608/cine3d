'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Clock3, Crown, Eye, Flag, Heart, MessageCircle, Pin, Send, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useStore } from '../../hooks/useStore';

type CommentItem = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  isSpoiler?: boolean;
  isPinned?: boolean;
  timestampSeconds?: number | null;
  user: { username: string; avatar?: string | null; isVip?: boolean };
  replies?: CommentItem[];
};

const fallbackAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80';

export default function MovieComments({ movieId, currentTime = 0, onSeek }: { movieId: string; currentTime?: number; onSeek?: (seconds: number) => void }) {
  const { user, showToast } = useStore();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [attachTimestamp, setAttachTimestamp] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');

  useEffect(() => {
    let active = true;
    api.get(`/movies/${movieId}/comments`, { params: { sort } })
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
  }, [movieId, sort, user?.id]);

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
      const response = await api.post(`/movies/${movieId}/comments`, { content: value, isSpoiler, timestampSeconds: attachTimestamp ? Math.floor(currentTime) : null });
      setComments((current) => [{ ...response.data, likesCount: 0, isLiked: false, replies: [] }, ...current]);
      setContent('');
      setIsSpoiler(false);
      setAttachTimestamp(false);
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

  const togglePin = async (commentId: string) => {
    try {
      const response = await api.put(`/comments/${commentId}/pin`);
      setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, isPinned: response.data.isPinned } : comment)
        .sort((first, second) => Number(Boolean(second.isPinned)) - Number(Boolean(first.isPinned))));
      showToast(response.data.isPinned ? 'Đã ghim bình luận.' : 'Đã bỏ ghim bình luận.', 'success');
    } catch {
      showToast('Không thể cập nhật ghim.', 'error');
    }
  };

  const reportComment = async (comment: CommentItem) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để báo cáo.', 'info');
      return;
    }
    const reason = window.prompt('Mô tả lý do báo cáo bình luận này:');
    if (!reason?.trim()) return;
    try {
      await api.post('/reports', { movieId, commentId: comment.id, type: 'abusive_comment', content: reason.trim() });
      showToast('Đã gửi báo cáo cho quản trị viên.', 'success');
    } catch {
      showToast('Không thể gửi báo cáo.', 'error');
    }
  };

  const actions = (comment: CommentItem, canReply: boolean) => (
    <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
      <button type="button" onClick={() => void toggleLike(comment.id)} className={`flex items-center gap-1 transition hover:text-red-400 ${comment.isLiked ? 'text-red-400' : ''}`}>
        <Heart className={`h-3.5 w-3.5 ${comment.isLiked ? 'fill-current' : ''}`} /> {comment.likesCount || 0}
      </button>
      {canReply && user && <button type="button" onClick={() => { setReplyingTo(comment.id); setReplyContent(''); }} className="transition hover:text-white">Trả lời</button>}
      {user && user.id !== comment.userId && <button type="button" onClick={() => void reportComment(comment)} className="flex items-center gap-1 transition hover:text-amber-400"><Flag className="h-3.5 w-3.5" /> Báo cáo</button>}
      {canReply && user?.role === 'ADMIN' && <button type="button" onClick={() => void togglePin(comment.id)} className={`flex items-center gap-1 transition hover:text-purple-300 ${comment.isPinned ? 'text-purple-300' : ''}`}><Pin className={`h-3.5 w-3.5 ${comment.isPinned ? 'fill-current' : ''}`} /> {comment.isPinned ? 'Bỏ ghim' : 'Ghim'}</button>}
      {user && (user.id === comment.userId || user.role === 'ADMIN') && (
        <button type="button" onClick={() => void deleteComment(comment.id)} className="flex items-center gap-1 transition hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Xóa</button>
      )}
    </div>
  );

  const formatTimestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const commentBody = (comment: CommentItem, textClass: string) => {
    const hidden = comment.isSpoiler && !revealedSpoilers.has(comment.id);
    return <>
      {comment.timestampSeconds !== null && comment.timestampSeconds !== undefined && <button type="button" onClick={() => onSeek?.(comment.timestampSeconds!)} className="mt-1 inline-flex items-center gap-1 rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400/20"><Clock3 className="h-3 w-3" /> {formatTimestamp(comment.timestampSeconds)}</button>}
      {hidden ? <button type="button" onClick={() => setRevealedSpoilers((current) => new Set(current).add(comment.id))} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/15 bg-amber-400/5 p-3 text-xs font-bold text-amber-300"><Eye className="h-4 w-4" /> Nội dung có spoiler · Nhấn để xem</button> : <p className={`mt-1 whitespace-pre-wrap break-words ${textClass}`}>{comment.content}</p>}
    </>;
  };

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left shadow-2xl backdrop-blur md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-white"><MessageCircle className="h-5 w-5 text-red-500" /> Bình luận</h2>
        <div className="flex items-center gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-400">{comments.length} thảo luận</span><select value={sort} onChange={(event) => setSort(event.target.value as 'newest' | 'popular')} aria-label="Sắp xếp bình luận" className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-[10px] font-bold text-slate-300 outline-none"><option value="newest">Mới nhất</option><option value="popular">Nổi bật</option></select></div>
      </div>

      {user ? (
        <form onSubmit={postComment} className="mb-7 flex gap-3">
          <Image src={user.avatar || fallbackAvatar} alt={user.username} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 p-2 focus-within:border-red-500/50">
            <div className="flex gap-2"><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={2} placeholder="Chia sẻ cảm nhận về bộ phim..." className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-600" /><button disabled={!content.trim() || submitting} className="self-end rounded-lg bg-red-600 p-2.5 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40" title="Gửi bình luận"><Send className="h-4 w-4" /></button></div>
            <div className="flex flex-wrap gap-3 border-t border-white/5 px-2 pt-2 text-[10px] font-bold text-slate-500"><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} className="accent-amber-400" /> Có spoiler</label><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={attachTimestamp} onChange={(event) => setAttachTimestamp(event.target.checked)} className="accent-cyan-400" /> Gắn mốc {formatTimestamp(currentTime)}</label></div>
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
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-200">{comment.user.username}</span>{comment.user.isVip && <span className="flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black text-amber-300"><Crown className="h-2.5 w-2.5" /> VIP</span>}{comment.isPinned && <span className="flex items-center gap-1 rounded bg-purple-400/10 px-1.5 py-0.5 text-[8px] font-black text-purple-300"><Pin className="h-2.5 w-2.5 fill-current" /> Đã ghim</span>}<time className="text-[10px] text-slate-600">{new Date(comment.createdAt).toLocaleDateString('vi-VN')}</time></div>
                  {commentBody(comment, 'text-sm leading-relaxed text-slate-300')}
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
                <div key={reply.id} className="flex gap-3"><Image src={reply.user.avatar || fallbackAvatar} alt={reply.user.username} width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-300">{reply.user.username}</span><time className="text-[9px] text-slate-600">{new Date(reply.createdAt).toLocaleDateString('vi-VN')}</time></div>{commentBody(reply, 'text-xs leading-relaxed text-slate-400')}{actions(reply, false)}</div></div>
              ))}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
