import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Heart, Medal, MessageCircle, TrendingUp } from 'lucide-react-native';
import { Text } from 'react-native-paper';
import type { CommunityComment, CommunityHome, Movie } from '@/domain/models';
import { colors, spacing } from '@/theme';

export function CommunityHub({ data, fallbackHot, fallbackFavorite }: {
  data?: CommunityHome;
  fallbackHot: Movie[];
  fallbackFavorite: Movie[];
}) {
  const hot = data?.hotMovies.length ? data.hotMovies : fallbackHot;
  const favorite = data?.favoriteMovies.length ? data.favoriteMovies : fallbackFavorite;
  if (!data?.topComments.length && !data?.latestComments.length && !hot.length) return null;
  return <View style={styles.container}>
    <View style={styles.heading}><Medal size={22} color={colors.warning} /><Text variant="titleLarge" style={styles.title}>Cộng đồng CINE3D</Text></View>
    {data?.topComments.length ? <>
      <Text variant="titleMedium" style={styles.sectionTitle}>Top bình luận</Text>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commentRow}>
        {data.topComments.slice(0, 8).map((comment) => <CommentCard key={comment.id} comment={comment} />)}
      </ScrollView>
    </> : null}
    <Ranking title="Sôi nổi nhất" icon={<TrendingUp size={18} color={colors.primary} />} movies={hot} />
    <Ranking title="Yêu thích nhất" icon={<Heart size={18} color={colors.warning} fill={colors.warning} />} movies={favorite} />
    {data?.latestComments.length ? <View style={styles.block}>
      <View style={styles.subheading}><MessageCircle size={18} color={colors.primary} /><Text variant="titleMedium">Bình luận mới</Text></View>
      {data.latestComments.slice(0, 4).map((comment) => <LatestComment key={comment.id} comment={comment} />)}
    </View> : null}
  </View>;
}

function CommentCard({ comment }: { comment: CommunityComment }) {
  const content = <Pressable style={styles.commentCard} disabled={!comment.movie} accessibilityRole={comment.movie ? 'button' : undefined}>
    <View style={styles.commentTop}>
      <Image source={comment.user.avatar || undefined} style={styles.avatar} contentFit="cover" />
      <View style={styles.identity}><Text numberOfLines={1} style={styles.author}>{comment.user.username}{comment.user.isVip ? ' ∞' : ''}</Text>{comment.movie ? <Text numberOfLines={1} style={styles.movie}>{comment.movie.title}</Text> : null}</View>
      {comment.movie ? <Image source={comment.movie.posterUrl} style={styles.commentPoster} contentFit="cover" /> : null}
    </View>
    <Text numberOfLines={3} style={styles.copy}>{comment.content}</Text>
    <Text style={styles.likes}>♥ {comment.likesCount}</Text>
  </Pressable>;
  return comment.movie ? <Link href={{ pathname: '/movies/[slug]', params: { slug: comment.movie.slug } }} asChild>{content}</Link> : content;
}

function LatestComment({ comment }: { comment: CommunityComment }) {
  const content = <Pressable style={styles.latest} disabled={!comment.movie} accessibilityRole={comment.movie ? 'button' : undefined}>
    <Text numberOfLines={1} style={styles.author}>{comment.user.username}</Text>
    <Text numberOfLines={2} style={styles.copy}>{comment.content}</Text>
    {comment.movie ? <Text numberOfLines={1} style={styles.movie}>▶ {comment.movie.title}</Text> : null}
  </Pressable>;
  return comment.movie ? <Link href={{ pathname: '/movies/[slug]', params: { slug: comment.movie.slug } }} asChild>{content}</Link> : content;
}

function Ranking({ title, icon, movies }: { title: string; icon: ReactNode; movies: Movie[] }) {
  if (!movies.length) return null;
  return <View style={styles.block}>
    <View style={styles.subheading}>{icon}<Text variant="titleMedium">{title}</Text></View>
    {movies.slice(0, 5).map((movie, index) => <Link key={movie.id || movie.slug} href={{ pathname: '/movies/[slug]', params: { slug: movie.slug } }} asChild>
      <Pressable style={styles.rankRow} accessibilityRole="button">
        <Text style={styles.rankNumber}>{index + 1}</Text><Image source={movie.posterUrl} style={styles.rankPoster} contentFit="cover" /><Text numberOfLines={1} style={styles.rankTitle}>{movie.title}</Text><Text style={styles.arrow}>›</Text>
      </Pressable>
    </Link>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { margin: spacing.md, marginTop: spacing.xl, paddingTop: spacing.md, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: { fontWeight: '900' },
  sectionTitle: { paddingHorizontal: spacing.md, marginBottom: spacing.sm, fontWeight: '700' },
  commentRow: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  commentCard: { width: 280, minHeight: 178, borderRadius: 14, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceRaised },
  commentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  identity: { flex: 1 },
  commentPoster: { width: 38, height: 57, borderRadius: 6, backgroundColor: colors.border },
  author: { fontWeight: '700' },
  movie: { color: colors.primary, fontSize: 12, marginTop: 2 },
  copy: { color: colors.textMuted, lineHeight: 20 },
  likes: { color: colors.textMuted, fontSize: 12 },
  block: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.md, gap: spacing.xs },
  subheading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rankRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rankNumber: { width: 24, color: colors.textMuted, fontSize: 17, fontWeight: '800' },
  rankPoster: { width: 32, height: 48, borderRadius: 5, backgroundColor: colors.border },
  rankTitle: { flex: 1, fontWeight: '600' },
  arrow: { color: colors.textMuted, fontSize: 26 },
  latest: { padding: spacing.sm, marginBottom: spacing.xs, borderRadius: 10, backgroundColor: colors.surfaceRaised },
});
