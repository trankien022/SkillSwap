export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface PushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: {
    readonly notificationId: string;
    readonly type: string;
    readonly targetType: string;
    readonly targetId: string;
  };
  readonly channelId: 'default' | 'skillswap-updates-v1';
  readonly sound: 'default';
}

export type PushProviderResult =
  | { readonly status: 'ok'; readonly ticketId?: string }
  | { readonly status: 'error'; readonly message: string; readonly deviceNotRegistered: boolean };

export interface PushProviderPort {
  send(message: PushMessage): Promise<PushProviderResult>;
  getReceipts(ticketIds: readonly string[]): Promise<Readonly<Record<string, PushProviderResult>>>;
}
