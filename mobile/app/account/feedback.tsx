import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { accountApi, type Feedback } from '@/features/account/data/account-api';
import { colors, spacing } from '@/theme';

const categories = [
  { value: 'GENERAL', label: 'Chung' }, { value: 'MOVIE_REQUEST', label: 'Yêu cầu phim' },
  { value: 'FEATURE', label: 'Tính năng' }, { value: 'WEBSITE_ERROR', label: 'Lỗi' },
  { value: 'VIP_SUPPORT', label: 'VIP' }, { value: 'COPYRIGHT', label: 'Bản quyền' },
];
export default function FeedbackRoute() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [items, setItems] = useState<Feedback[]>([]);
  const [category, setCategory] = useState(
    categories.some((item) => item.value === params.category) ? params.category! : 'GENERAL',
  );
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const load = () => accountApi.feedback().then(setItems).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);
  const submit = async () => {
    if (subject.trim().length < 5 || content.trim().length < 10) return setMessage('Tiêu đề tối thiểu 5 ký tự và nội dung tối thiểu 10 ký tự.');
    try {
      const result = await accountApi.createFeedback({ category, subject, content });
      setMessage(result.message); setSubject(''); setContent(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể gửi góp ý.'); }
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Góp ý và hỗ trợ</Text>
      <SegmentedButtons value={category} onValueChange={setCategory} buttons={categories} density="small" />
      <TextInput label="Tiêu đề" value={subject} onChangeText={setSubject} maxLength={120} />
      <TextInput label="Nội dung" value={content} onChangeText={setContent} multiline numberOfLines={5} maxLength={3000} />
      <Button mode="contained" onPress={() => void submit()}>Gửi góp ý</Button>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text variant="titleLarge">Lịch sử</Text>
      {items.map((item) => <Card key={item.id}>
        <Card.Title title={item.subject} subtitle={`${item.category} · ${item.status}`} />
        <Card.Content>
          <Text>{item.content}</Text>
          {item.adminReply ? <Text style={styles.reply}>Phản hồi CINE3D: {item.adminReply}</Text> : null}
        </Card.Content>
      </Card>)}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  message: { color: colors.warning }, reply: { marginTop: spacing.md, color: colors.success },
});
