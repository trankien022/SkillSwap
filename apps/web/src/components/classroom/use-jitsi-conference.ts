'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildJitsiOptions,
  jitsiHostFromUrl,
  jitsiProtocolFromUrl,
  jitsiRoomNameFromUrl,
  jitsiScriptBaseFromUrl,
  loadJitsiExternalApi,
  type JitsiApi,
} from './jitsi-external-api';

/**
 * FR-011 / ADR-040: the Jitsi iframe lifecycle, extracted so the learner and teacher
 * classrooms cannot drift apart.
 *
 * Why this exists: both rooms are the same conference with the same tenant, token and
 * options; the only difference is who the viewer is. Two copies of this effect would drift at
 * the first change to any of them, and the failure would be one-sided (one classroom breaks,
 * the other keeps working), which is the hardest kind to notice.
 *
 * The subtle part, preserved verbatim from the original single-user implementation: the
 * effect must be keyed on the *access values only*. Re-running it when `connected` flips
 * tears down the conference that just connected and the iframe vanishes while the UI still
 * claims the call is live.
 */

export interface JitsiAccess {
  room: string;
  token: string;
  url: string;
}

export interface UseJitsiConferenceOptions {
  access: JitsiAccess | null;
  displayName: string;
  /** Called when the iframe is mounted and Jitsi shows its own prejoin screen. */
  onPrejoin: () => void;
  /** Called on `videoConferenceJoined` — the first moment the user is really in the room. */
  onJoined: () => void;
  /** Called when the script or the embed failed, so the caller can offer a retry. */
  onEmbedError: () => void;
}

export interface JitsiConferenceHandle {
  stageRef: React.RefObject<HTMLDivElement | null>;
  micMuted: boolean;
  videoMuted: boolean;
  sharingScreen: boolean;
  runCommand: (command: string) => void;
}

export function useJitsiConference(options: UseJitsiConferenceOptions): JitsiConferenceHandle {
  const { access, displayName, onPrejoin, onJoined, onEmbedError } = options;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const jitsiRef = useRef<JitsiApi | null>(null);
  const [micMuted, setMicMuted] = useState<boolean>(true);
  const [videoMuted, setVideoMuted] = useState<boolean>(false);
  const [sharingScreen, setSharingScreen] = useState<boolean>(false);

  // Callbacks live in a ref so a caller that re-creates them on every render does not
  // re-run the mount effect and dispose a healthy conference.
  const callbacks = useRef({ onPrejoin, onJoined, onEmbedError, displayName });
  callbacks.current = { onPrejoin, onJoined, onEmbedError, displayName };

  const accessUrl = access?.url ?? null;
  const accessRoom = access?.room ?? null;
  const accessToken = access?.token ?? null;

  useEffect(() => {
    if (accessUrl === null || accessRoom === null || accessToken === null) return;
    const container = stageRef.current;
    if (container === null) return;

    let cancelled = false;
    const listeners: Array<{ event: string; handler: (payload: unknown) => void }> = [];

    const readBoolean = (payload: unknown, field: string): boolean | null => {
      if (typeof payload !== 'object' || payload === null) return null;
      const value = (payload as Record<string, unknown>)[field];
      return typeof value === 'boolean' ? value : null;
    };

    const mount = async () => {
      try {
        // The script is served per tenant (JaaS: `https://8x8.vc/<appId>/external_api.js`),
        // while the constructor wants a bare HOST (it prepends the protocol itself).
        const base = jitsiScriptBaseFromUrl(accessUrl);
        const JitsiMeetExternalAPI = await loadJitsiExternalApi(base);
        if (cancelled) return;

        const api = new JitsiMeetExternalAPI(
          jitsiHostFromUrl(accessUrl),
          buildJitsiOptions({
            // JaaS needs the tenant-prefixed name (`<appId>/<room>`), so it is taken from the
            // access URL rather than from the provider-agnostic `room` field.
            roomName: jitsiRoomNameFromUrl(accessUrl),
            parentNode: container,
            protocol: jitsiProtocolFromUrl(accessUrl),
            jwt: accessToken,
            displayName: callbacks.current.displayName,
            audioMuted: true,
            videoMuted: false,
            prejoinEnabled: true,
          }),
        );
        jitsiRef.current = api;

        const onAudio = (payload: unknown) => {
          const muted = readBoolean(payload, 'muted');
          if (muted !== null) setMicMuted(muted);
        };
        const onVideo = (payload: unknown) => {
          const muted = readBoolean(payload, 'muted');
          if (muted !== null) setVideoMuted(muted);
        };
        const onScreenShare = (payload: unknown) => {
          const on = readBoolean(payload, 'on');
          if (on !== null) setSharingScreen(on);
        };

        listeners.push(
          { event: 'audioMuteStatusChanged', handler: onAudio },
          { event: 'videoMuteStatusChanged', handler: onVideo },
          { event: 'screenSharingStatusChanged', handler: onScreenShare },
          { event: 'videoConferenceJoined', handler: () => callbacks.current.onJoined() },
        );
        for (const { event, handler } of listeners) {
          api.addEventListener(event, handler);
        }

        // The embed is up: show Jitsi's own prejoin WITHOUT claiming anyone is in the room.
        // `connected` is only reported on `videoConferenceJoined`, so the status bar and the
        // timer never describe a call that has not started.
        callbacks.current.onPrejoin();
      } catch {
        if (!cancelled) callbacks.current.onEmbedError();
      }
    };

    void mount();

    return () => {
      cancelled = true;
      const api = jitsiRef.current;
      if (api !== null) {
        for (const { event, handler } of listeners) {
          api.removeEventListener(event, handler);
        }
        api.dispose();
        jitsiRef.current = null;
      }
      // Do not leave a detached container behind for the next mount.
      if (container !== null) container.replaceChildren();
    };
  }, [accessUrl, accessRoom, accessToken]);

  const runCommand = (command: string) => {
    const api = jitsiRef.current;
    if (api === null) return;
    api.executeCommand(command);
  };

  return { stageRef, micMuted, videoMuted, sharingScreen, runCommand };
}
