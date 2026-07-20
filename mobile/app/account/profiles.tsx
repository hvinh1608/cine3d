import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';
import type { Profile } from '@/domain/models';
import { accountApi } from '@/features/account/data/account-api';
import { validProfilePin } from '@/features/account/domain/validation';
import { useAppStore } from '@/state/app-store';
import { colors, spacing } from '@/theme';

export default function ProfilesRoute() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isKids, setKids] = useState(false);
  const [message, setMessage] = useState('');
  const active = useAppStore((state) => state.session.activeProfile);
  const setActive = useAppStore((state) => state.setActiveProfile);
  const queryClient = useQueryClient();
  const load = () => accountApi.profiles().then(setProfiles).catch((error) => setMessage(error.message));
  useEffect(() => { void load(); }, []);

  const clear = () => { setEditing(null); setName(''); setPin(''); setKids(false); };
  const edit = (profile: Profile) => { setEditing(profile); setName(profile.name); setKids(profile.isKids); setPin(''); };
  const save = async () => {
    if (!name.trim() || name.trim().length > 30) return setMessage('Tên hồ sơ phải từ 1 đến 30 ký tự.');
    if (pin && !validProfilePin(pin)) return setMessage('PIN phải gồm đúng 4 chữ số.');
    try {
      if (editing) await accountApi.updateProfile(editing.id, { name, isKids, ...(pin ? { pin } : {}) });
      else await accountApi.createProfile({ name, isKids, ...(pin ? { pin } : {}) });
      clear(); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu hồ sơ.'); }
  };
  const switchProfile = async (profile: Profile) => {
    if (profile.pinEnabled || (profile as Profile & { hasPin?: boolean }).hasPin) {
      if (!validProfilePin(pin)) return setMessage('Nhập PIN 4 số của hồ sơ để chuyển.');
      try { if (!(await accountApi.verifyPin(profile.id, pin))) return setMessage('PIN không đúng.'); }
      catch (error) { return setMessage(error instanceof Error ? error.message : 'PIN không đúng.'); }
    }
    setActive(profile);
    setPin('');
    await queryClient.invalidateQueries();
    setMessage(`Đã chuyển sang ${profile.name}.`);
  };
  const remove = (profile: Profile) => Alert.alert('Xóa hồ sơ?', profile.name, [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xóa', style: 'destructive', onPress: () => void accountApi.deleteProfile(profile.id).then(async () => {
      if (active?.id === profile.id) setActive(null);
      await queryClient.invalidateQueries();
      await load();
    }).catch((error) => setMessage(error.message)) },
  ]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text variant="headlineSmall">Hồ sơ người xem ({profiles.length}/5)</Text>
      {profiles.map((profile) => (
        <Card key={profile.id} mode={active?.id === profile.id ? 'contained' : 'outlined'}>
          <Card.Title title={profile.name} subtitle={`${profile.isKids ? 'Trẻ em · ' : ''}${(profile as Profile & { hasPin?: boolean }).hasPin ? 'Có PIN' : 'Không PIN'}`} />
          <Card.Actions>
            <Button onPress={() => void switchProfile(profile)}>{active?.id === profile.id ? 'Đang dùng' : 'Chuyển'}</Button>
            <Button onPress={() => edit(profile)}>Sửa</Button>
            <Button textColor={colors.primarySoft} onPress={() => remove(profile)}>Xóa</Button>
          </Card.Actions>
        </Card>
      ))}
      {profiles.some((profile) => (profile as Profile & { hasPin?: boolean }).hasPin) ? <TextInput label="PIN để chuyển hồ sơ (nếu có)" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry /> : null}
      <View style={styles.form}>
        <Text variant="titleMedium">{editing ? 'Sửa hồ sơ' : 'Tạo hồ sơ'}</Text>
        <TextInput label="Tên hồ sơ" value={name} onChangeText={setName} />
        <TextInput label={editing ? 'PIN mới (để trống để giữ nguyên)' : 'PIN 4 số (không bắt buộc)'} value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
        <View style={styles.row}><Text>Hồ sơ trẻ em</Text><Switch value={isKids} onValueChange={setKids} /></View>
        <Button mode="contained" disabled={!editing && profiles.length >= 5} onPress={() => void save()}>Lưu hồ sơ</Button>
        {editing?.hasPin ? <Button textColor={colors.primarySoft} onPress={() => void accountApi.updateProfile(editing.id, { pin: '' }).then(async () => { clear(); await load(); setMessage('Đã xóa PIN hồ sơ.'); }).catch((error) => setMessage(error.message))}>Xóa PIN</Button> : null}
        {editing ? <Button onPress={clear}>Hủy sửa</Button> : null}
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  form: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  message: { color: colors.warning },
});
