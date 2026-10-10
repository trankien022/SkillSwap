import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  RoomIncident,
  RoomIncidentRecorder,
} from '../../../application/port/out/room-incident-recorder';

const INCIDENTS_TABLE = 'room_access_incidents';

export class SqlRoomIncidentRecorder implements RoomIncidentRecorder {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async record(incident: RoomIncident): Promise<void> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.registry.getSchema(this.moduleName), INCIDENTS_TABLE);
    await source.query(
      `INSERT INTO ${table} ("booking_id", "class_id", "requester_id", "reason", "trace_id")
       VALUES ($1, $2, $3, $4, $5)`,
      [incident.bookingId, incident.classId, incident.requesterId, incident.reason, incident.traceId],
    );
  }
}
