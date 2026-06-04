import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardTypeOptions,
  ScrollView,
  type TextInputProps,
} from 'react-native';
import { colors, fonts } from '../../theme';

interface Props {
  label: string;
  optional?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  phonePrefix?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  onFocus?: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  returnKeyType?: 'done' | 'next' | 'search' | 'send' | 'go';
  onSubmitEditing?: () => void;
}

export default function InputField({
  label,
  optional,
  placeholder,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  onRightPress,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  phonePrefix,
  autoComplete,
  textContentType,
  onFocus,
  scrollRef,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [layoutY, setLayoutY] = useState(0);

  const handleFocus = () => {
    if (scrollRef?.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, layoutY - 30), animated: true });
      }, 50);
    }
    onFocus?.();
  };

  return (
    <View style={styles.wrap} onLayout={e => setLayoutY(e.nativeEvent.layout.y)}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optional}>facultatif</Text>}
      </View>

      <View style={styles.row}>
        {phonePrefix ? (
          <>
            <Text style={styles.flag}>🇸🇳 +221</Text>
            <View style={styles.divider} />
          </>
        ) : (
          leftIcon
        )}

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#5a5c80"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          onFocus={handleFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={returnKeyType !== 'next'}
        />

        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} activeOpacity={0.7} hitSlop={8}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  label: {
    color: colors.muted,
    fontFamily: fonts.ui,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  optional: {
    color: '#5a5c80',
    fontFamily: fonts.label,
    fontSize: 12,
    fontStyle: 'italic',
  },
  row: {
    height: 53,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  flag: {
    color: colors.white,
    fontFamily: fonts.ui,
    fontSize: 14,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
