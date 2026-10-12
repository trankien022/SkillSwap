import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { AppButton, LabeledInput, SurfaceCard } from './primitives';
import {
  getLocalizedAuthError,
  validateAuthInput,
  type AuthInput,
  type AuthValidationResult,
} from './auth-validation';
import { useSession } from './session-context';

export {
  getLocalizedAuthError,
  validateAuthInput,
  type AuthInput,
  type AuthValidationResult,
};

export interface AuthFormProps {
  readonly mode: 'sign-in' | 'register';
  readonly onToggleMode: () => void;
}

export function AuthForm({ mode, onToggleMode }: AuthFormProps) {
  const { t, login, register, locale, setLocale } = useSession();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const validate = (): boolean => {
    setValidationError(null);
    setApiError(null);

    const result = validateAuthInput(
      { email, password, displayName, confirmPassword },
      mode,
      t,
    );

    if (!result.valid && result.error) {
      setValidationError(result.error);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      if (isRegister) {
        await register({
          email: email.trim(),
          displayName: displayName.trim(),
          password,
          role: 'user',
        });
      } else {
        await login({
          email: email.trim(),
          password,
        });
      }
    } catch (err) {
      setApiError(getLocalizedAuthError(err, isRegister, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.brandTitle}>SkillSwap</Text>
          <Pressable
            style={styles.langToggle}
            onPress={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
            accessibilityRole="button"
            accessibilityLabel={t('Auth.switchLanguage')}
          >
            <Text style={styles.langToggleText}>
              {locale === 'vi' ? 'EN' : 'VI'}
            </Text>
          </Pressable>
        </View>

        <SurfaceCard style={styles.card}>
          <Text style={styles.title}>
            {isRegister ? t('Auth.registerTitle') : t('Auth.signInTitle')}
          </Text>

          {validationError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {apiError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{apiError}</Text>
            </View>
          ) : null}

          <LabeledInput
              style={styles.input}
              label={t('Auth.emailLabel')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setValidationError(null);
              }}
              placeholder="student@school.edu.vn"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!isSubmitting}
            />

          {isRegister ? (
              <LabeledInput
                style={styles.input}
                label={t('Auth.displayNameLabel')}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setValidationError(null);
                }}
                placeholder="Nguyen Van A"
                placeholderTextColor={colors.inkMuted}
                editable={!isSubmitting}
              />
          ) : null}

            <LabeledInput
              style={styles.input}
              label={t('Auth.passwordLabel')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setValidationError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
              autoCapitalize="none"
              editable={!isSubmitting}
            />

          {isRegister ? (
              <LabeledInput
                style={styles.input}
                label={t('Auth.confirmPasswordLabel')}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setValidationError(null);
                }}
                placeholder="••••••••"
                placeholderTextColor={colors.inkMuted}
                secureTextEntry
                autoCapitalize="none"
                editable={!isSubmitting}
              />
          ) : null}

          <AppButton
            onPress={handleSubmit}
            label={isRegister ? t('Auth.registerButton') : t('Auth.signInButton')}
            busy={isSubmitting}
            style={styles.submitButton}
          />

          <Pressable
            style={styles.switchButton}
            onPress={() => {
              setValidationError(null);
              setApiError(null);
              onToggleMode();
            }}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            <Text style={styles.switchButtonText}>
              {isRegister
                ? t('Auth.switchToSignIn')
                : t('Auth.switchToRegister')}
            </Text>
          </Pressable>
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  langToggle: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langToggleText: {
    color: colors.inkSoft,
    fontSize: typography.label.fontSize,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  errorText: {
    color: colors.dangerInk,
    fontSize: typography.label.fontSize,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.mist,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  switchButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchButtonText: {
    color: colors.inkSoft,
    fontSize: typography.label.fontSize,
  },
});
