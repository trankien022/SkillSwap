export const ROOM_INCIDENT_RECORDER = Symbol('RoomIncidentRecorder');

export interface RoomIncident {
  bookingId: string;
  classId: string | null;
  requesterId: string;
  reason: string;
  traceId: string;
}

/** Records a room-access incident for audit (NFR-006/NFR-009). Never throws. */
export interface RoomIncidentRecorder {
  record(incident: RoomIncident): Promise<void>;
}
