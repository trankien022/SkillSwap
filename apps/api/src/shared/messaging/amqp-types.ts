import type { connect } from 'amqplib';

/**
 * Derived amqplib types — amqplib's named type exports differ across
 * versions, so everything here is computed from `connect`'s return type.
 */
export type AmqpConnection = Awaited<ReturnType<typeof connect>>;
export type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;
export type AmqpConfirmChannel = Awaited<ReturnType<AmqpConnection['createConfirmChannel']>>;
export type AmqpMessage = Parameters<AmqpChannel['ack']>[0];
type AmqpConsumeCallback = NonNullable<Parameters<AmqpChannel['consume']>[1]>;
/** The callback's `null` branch (broker cancel) is filtered before dispatch. */
export type AmqpConsumeMessage = NonNullable<Parameters<AmqpConsumeCallback>[0]>;
