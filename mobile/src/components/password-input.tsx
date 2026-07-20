import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native-paper';

export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry' | 'right'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      secureTextEntry={!visible}
      right={(
        <TextInput.Icon
          icon={visible ? 'eye-off' : 'eye'}
          onPress={() => setVisible((current) => !current)}
          accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        />
      )}
    />
  );
}
