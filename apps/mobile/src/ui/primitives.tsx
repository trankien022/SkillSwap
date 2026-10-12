import React, { type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { colors, controls, layout, radius, spacing, typography } from '@/design/tokens';

export function Screen({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View {...props} style={[styles.screen, style]}>
      {children}
    </View>
  );
}

export function ScreenScroll({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function SurfaceCard({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function SectionHeading({
  title,
  action,
  style,
}: {
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly style?: ViewProps['style'];
}) {
  return (
    <View style={[styles.sectionHeading, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export type ButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';

export function AppButton({
  label,
  tone = 'primary',
  busy = false,
  style,
  disabled,
  accessibilityLabel,
  ...props
}: Omit<PressableProps, 'children'> & {
  readonly label: string;
  readonly tone?: ButtonTone;
  readonly busy?: boolean;
}) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        styles[`${tone}Button`],
        isDisabled && styles.buttonDisabled,
        state.pressed && !isDisabled && styles.buttonPressed,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'primary' ? colors.surface : colors.ink} />
      ) : (
        <Text style={[styles.buttonLabel, styles[`${tone}ButtonLabel`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function LabeledInput({
  label,
  error,
  helper,
  style,
  accessibilityLabel,
  ...props
}: TextInputProps & {
  readonly label: string;
  readonly error?: string | null;
  readonly helper?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.input, style, error ? styles.inputError : undefined]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </View>
  );
}

export type FeedbackTone = 'success' | 'warning' | 'danger' | 'neutral';

export function FeedbackBanner({
  tone,
  title,
  children,
}: PropsWithChildren<{ readonly tone: FeedbackTone; readonly title?: string }>) {
  const palette = feedbackPalette[tone];
  return (
    <View
      accessibilityRole="summary"
      style={[styles.feedback, { backgroundColor: palette.backgroundColor }]}
    >
      {title ? <Text style={[styles.feedbackTitle, { color: palette.color }]}>{title}</Text> : null}
      {children ? <Text style={[styles.feedbackBody, { color: palette.color }]}>{children}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action}
    </View>
  );
}

const feedbackPalette: Record<FeedbackTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: colors.successTint, color: colors.successInk },
  warning: { backgroundColor: colors.warningTint, color: colors.warningInk },
  danger: { backgroundColor: colors.dangerTint, color: colors.dangerInk },
  neutral: { backgroundColor: colors.neutralTint, color: colors.neutralInk },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  screenContent: {
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageVertical,
    paddingBottom: spacing.xxxl,
    gap: layout.sectionGap,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
  },
  button: {
    minHeight: controls.buttonHeight,
    minWidth: controls.minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: { backgroundColor: colors.campusEmerald },
  secondaryButton: { backgroundColor: colors.ink, borderRadius: radius.small },
  quietButton: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  dangerButton: { backgroundColor: colors.dangerTint, borderColor: colors.dangerTint, borderWidth: 1 },
  buttonLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButtonLabel: { color: colors.surface },
  secondaryButtonLabel: { color: colors.surface },
  quietButtonLabel: { color: colors.ink },
  dangerButtonLabel: { color: colors.dangerInk },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.82 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: typography.label.fontSize, fontWeight: '600' },
  input: {
    minHeight: controls.inputHeight,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: typography.body.fontSize,
  },
  inputError: { borderColor: colors.dangerInk },
  fieldError: { color: colors.dangerInk, fontSize: typography.caption.fontSize },
  fieldHelper: { color: colors.inkMuted, fontSize: typography.caption.fontSize },
  feedback: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  feedbackTitle: { fontSize: typography.label.fontSize, fontWeight: '700' },
  feedbackBody: { fontSize: typography.body.fontSize, lineHeight: 24 },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    borderRadius: radius.card,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  emptyTitle: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '600', textAlign: 'center' },
  emptyDescription: { color: colors.inkSoft, fontSize: typography.body.fontSize, lineHeight: 24, textAlign: 'center' },
});
