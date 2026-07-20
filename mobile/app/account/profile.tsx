import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Button, Text, TextInput } from 'react-native-paper';
import { accountApi } from '@/features/account/data/account-api';
import { useAppStore } from '@/state/app-store';
import { colors, radius, spacing } from '@/theme';

const PRESET_AVATARS = [
  {
    url: 'https://cine3d.id.vn/avatars/1.jpg',
    image: require('../../assets/avatars/1.jpg'),
  },
  {
    url: 'https://cine3d.id.vn/avatars/2.jpg',
    image: require('../../assets/avatars/2.jpg'),
  },
  {
    url: 'https://cine3d.id.vn/avatars/3.jpg',
    image: require('../../assets/avatars/3.jpg'),
  },
  {
    url: 'https://cine3d.id.vn/avatars/4.jpg',
    image: require('../../assets/avatars/4.jpg'),
  },
  {
    url: 'https://cine3d.id.vn/avatars/5.jpg',
    image: require('../../assets/avatars/5.jpg'),
  },
  {
    url: 'https://cine3d.id.vn/avatars/6.jpg',
    image: require('../../assets/avatars/6.jpg'),
  },
] as const;

export default function ProfileRoute() {
  const user = useAppStore((state) => state.session.user);
  const setUser = useAppStore((state) => state.setUser);
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!user) return <Text>Vui lòng đăng nhập.</Text>;

  const selectedPreset = PRESET_AVATARS.find((item) => item.url === avatar);
  const previewSource = selectedPreset?.image || (avatar ? { uri: avatar } : undefined);

  const saveProfile = async () => {
    if (username.trim().length < 3 || username.trim().length > 40) {
      return setMessage('Tên phải từ 3 đến 40 ký tự.');
    }
    setBusy(true);
    try {
      setUser(await accountApi.updateUser({
        username: username.trim(),
        ...(avatar ? { avatar } : {}),
      }));
      setMessage('Đã cập nhật hồ sơ.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật.');
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setMessage('Cần quyền truy cập thư viện ảnh.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      const asset = result.assets[0]!;
      const next = await accountApi.uploadAvatar(asset.uri, asset.mimeType);
      setUser(next);
      setAvatar(next.avatar || '');
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải ảnh.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Image source={previewSource} style={styles.avatar} contentFit="cover" />
      <Text variant="titleMedium">Ảnh mẫu</Text>
      <Text style={styles.muted}>Tài khoản thường có thể chọn ảnh mẫu. VIP mới được tải ảnh riêng.</Text>
      <View style={styles.presets}>
        {PRESET_AVATARS.map((item) => {
          const selected = avatar === item.url;
          return (
            <Pressable
              key={item.url}
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh mẫu"
              onPress={() => setAvatar(item.url)}
              style={[styles.presetWrap, selected && styles.presetSelected]}
            >
              <Image source={item.image} style={styles.preset} contentFit="cover" />
            </Pressable>
          );
        })}
      </View>
      <Button disabled={!user.isVip || busy} onPress={() => void pickAvatar()}>Chọn ảnh từ thiết bị</Button>
      {!user.isVip ? <Text style={styles.muted}>Máy chủ hiện chỉ cho phép VIP tải ảnh tùy chọn.</Text> : null}
      <TextInput label="Tên hiển thị" value={username} onChangeText={setUsername} />
      <TextInput label="Email" value={user.email} disabled />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button mode="contained" loading={busy} disabled={busy} onPress={() => void saveProfile()}>Lưu thay đổi</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  avatar: { width: 112, height: 112, borderRadius: 56, alignSelf: 'center', backgroundColor: colors.surfaceRaised },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceRaised,
  },
  presetSelected: { borderColor: colors.primary },
  preset: { width: 72, height: 72 },
  muted: { color: colors.textMuted, textAlign: 'center' },
  message: { color: colors.warning },
});
