import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomAccessResponse } from '@skillswap/contracts';
import { useSession } from './session-context';
import { getJaasRoomTarget } from './jitsi-room-target';

type MeetingRef = { close: () => void };
type MeetingProps = {
  room: string;
  serverURL: string;
  token: string;
  config: Record<string, unknown>;
  userInfo: { displayName: string; email: string; avatarURL: string };
  eventListeners: { onReadyToClose: () => void };
  style: object;
};

/**
 * Load Jitsi only when a meeting is opened. The SDK initializes its own
 * navigation tree at module evaluation time, so importing it from the schedule
 * screen can otherwise crash the whole app before the learner joins a room.
 */
function loadJitsiMeeting():
  | React.ForwardRefExoticComponent<MeetingProps & React.RefAttributes<MeetingRef>>
  | null {
  try {
    // The SDK ships TypeScript source without a declaration entry point. Requiring
    // it here keeps tsc from typechecking the SDK's whole internal source tree.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const meeting = require('@jitsi/react-native-sdk').JitsiMeeting as unknown;
    return (typeof meeting === 'function' || (typeof meeting === 'object' && meeting !== null && '$$typeof' in meeting && meeting.$$typeof === Symbol.for('react.forward_ref')))
      ? (meeting as React.ForwardRefExoticComponent<MeetingProps & React.RefAttributes<MeetingRef>>)
      : null;
  } catch {
    return null;
  }
}

type JitsiRoomProps = {
  access: RoomAccessResponse | null;
  displayName: string;
  onClose: () => void;
};

export function JitsiRoom({ access, displayName, onClose }: JitsiRoomProps) {
  const { t, locale } = useSession();
  const meetingRef = useRef<MeetingRef>(null);
  if (!access) return null;

  let target: ReturnType<typeof getJaasRoomTarget> | null = null;
  try {
    target = getJaasRoomTarget(access);
  } catch {
    // Keep an error and exit action visible for invalid provider responses.
  }

  const JitsiMeeting = loadJitsiMeeting();

  const close = () => {
    meetingRef.current?.close();
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.container}>
        {JitsiMeeting && target ? (
          <JitsiMeeting
            ref={meetingRef}
            room={target.room}
            serverURL={target.serverURL}
            token={access.token}
            config={{ prejoinPageEnabled: false, defaultLanguage: locale }}
            userInfo={{ displayName, email: '', avatarURL: '' }}
            eventListeners={{ onReadyToClose: onClose }}
            style={styles.meeting}
          />
        ) : (
          <View style={styles.sdkUnavailable}>
            <Text style={styles.sdkUnavailableText}>
              {t(target ? 'Classroom.unavailable' : 'Classroom.invalidTarget')}
            </Text>
          </View>
        )}
        <Pressable
          style={styles.closeButton}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('Classroom.leave')}
        >
          <Text style={styles.closeText}>{t('Classroom.leave')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101318' },
  meeting: { flex: 1 },
  sdkUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sdkUnavailableText: { color: '#fff', textAlign: 'center' },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#29313b',
  },
  closeText: { color: '#fff', fontWeight: '600' },
});
