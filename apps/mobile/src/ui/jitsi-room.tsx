import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomAccessResponse } from '@skillswap/contracts';
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

// The SDK ships TypeScript source without a declaration entry point. Requiring it
// here keeps tsc from typechecking the SDK's whole internal source tree.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JitsiMeeting = require('@jitsi/react-native-sdk')
  .JitsiMeeting as React.ForwardRefExoticComponent<MeetingProps & React.RefAttributes<MeetingRef>>;

type JitsiRoomProps = {
  access: RoomAccessResponse | null;
  displayName: string;
  onClose: () => void;
};

export function JitsiRoom({ access, displayName, onClose }: JitsiRoomProps) {
  const meetingRef = useRef<MeetingRef>(null);
  if (!access) return null;

  let target: ReturnType<typeof getJaasRoomTarget>;
  try {
    target = getJaasRoomTarget(access);
  } catch {
    return null;
  }

  const close = () => {
    meetingRef.current?.close();
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.container}>
        <JitsiMeeting
          ref={meetingRef}
          room={target.room}
          serverURL={target.serverURL}
          token={access.token}
          config={{ prejoinPageEnabled: false }}
          userInfo={{ displayName, email: '', avatarURL: '' }}
          eventListeners={{ onReadyToClose: close }}
          style={styles.meeting}
        />
        <Pressable
          style={styles.closeButton}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Leave meeting"
        >
          <Text style={styles.closeText}>Leave meeting</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101318' },
  meeting: { flex: 1 },
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
