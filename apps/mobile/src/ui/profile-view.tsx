import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { AppButton, ScreenScroll, SurfaceCard } from './primitives';
import { useSession } from './session-context';

export function ProfileView() {
  const router = useRouter();
  const { t, user, locale, setLocale, logout } = useSession();
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const verificationStatus = user?.studentVerification?.status ?? 'notSubmitted';

  const getVerificationBadgeStyle = () => {
    switch (verificationStatus) {
      case 'approved':
        return { bg: colors.successTint, text: colors.successInk };
      case 'pending':
        return { bg: colors.warningTint, text: colors.warningInk };
      case 'rejected':
      case 'revoked':
        return { bg: colors.dangerTint, text: colors.dangerInk };
      default:
        return { bg: colors.neutralTint, text: colors.neutralInk };
    }
  };

  const badgeColors = getVerificationBadgeStyle();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScreenScroll contentContainerStyle={styles.container}>
      {/* 1. Account Details Card */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Profile.accountDetails')}</Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfoCol}>
            <Text style={styles.userName}>
              {user?.displayName ?? t('Common.defaultUserName')}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('Profile.roleLabel')}</Text>
          <Text style={styles.detailValue}>
            {user?.role === 'verifier'
              ? t('Dashboard.verifierRole')
              : user?.role === 'admin'
                ? t('Dashboard.adminRole')
                : t('Dashboard.userRole')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('Profile.statusLabel')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badgeColors.text }]}>
              {t(`Dashboard.${verificationStatus}`)}
            </Text>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Profile.learningAndTeaching')}</Text>
        <Pressable style={styles.linkButton} onPress={() => router.push('/(features)/verification')} accessibilityRole="button">
          <Text style={styles.linkButtonText}>{t('Profile.studentVerification')}</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.push('/(features)/skills')} accessibilityRole="button">
          <Text style={styles.linkButtonText}>{t('Profile.skillEvidence')}</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.push('/(features)/teaching')} accessibilityRole="button">
          <Text style={styles.linkButtonText}>{t('Profile.teachingClasses')}</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.push('/(features)/notifications')} accessibilityRole="button">
          <Text style={styles.linkButtonText}>{t('Profile.notifications')}</Text>
        </Pressable>
      </SurfaceCard>

      {/* 2. Language Selection Card */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Profile.languageSection')}</Text>

        <View style={styles.langSelectorRow}>
          <Pressable
            style={[
              styles.langOptionBtn,
              locale === 'vi' && styles.langOptionSelected,
            ]}
            onPress={() => setLocale('vi')}
            accessibilityRole="button"
            accessibilityLabel={t('Profile.languageVi')}
          >
            <Text
              style={[
                styles.langOptionText,
                locale === 'vi' && styles.langOptionTextSelected,
              ]}
            >
              VI · {t('Profile.languageVi')}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.langOptionBtn,
              locale === 'en' && styles.langOptionSelected,
            ]}
            onPress={() => setLocale('en')}
            accessibilityRole="button"
            accessibilityLabel={t('Profile.languageEn')}
          >
            <Text
              style={[
                styles.langOptionText,
                locale === 'en' && styles.langOptionTextSelected,
              ]}
            >
              EN · {t('Profile.languageEn')}
            </Text>
          </Pressable>
        </View>
      </SurfaceCard>

      {/* 3. Sign Out CTA */}
      <View style={styles.actionsContainer}>
        <AppButton
          onPress={() => void handleSignOut()}
          label={t('Profile.signOutButton')}
          tone="danger"
          busy={isSigningOut}
        />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.campusEmerald,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  userInfoCol: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: colors.ink,
  },
  userEmail: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.mist,
    marginVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
  },
  detailValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  statusBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  langSelectorRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  langOptionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  langOptionSelected: {
    borderColor: colors.campusEmerald,
    backgroundColor: colors.mist,
  },
  langOptionText: {
    fontSize: typography.label.fontSize,
    fontWeight: '500',
    color: colors.inkSoft,
  },
  langOptionTextSelected: {
    fontWeight: '700',
    color: colors.campusEmerald,
  },
  actionsContainer: {
    marginTop: spacing.md,
  },
  signOutBtn: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.dangerInk,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  signOutBtnPressed: {
    backgroundColor: colors.dangerTint,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  signOutBtnText: {
    color: colors.dangerInk,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  linkButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control },
  linkButtonText: { color: colors.campusEmerald, fontSize: typography.body.fontSize, fontWeight: '600' },
});
