import { notificationRoute } from './notification-target';

describe('notificationRoute', () => {
  it('opens booking notifications in the schedule and class targets in class detail', () => {
    expect(notificationRoute('booking', 'booking-1')).toEqual({ pathname: '/(tabs)/schedule' });
    expect(notificationRoute('class', 'class-1')).toEqual({ pathname: '/classes/[id]', params: { id: 'class-1' } });
  });

  it('routes profile targets and ignores unknown payload targets safely', () => {
    expect(notificationRoute('verification', 'verification-1')).toEqual({ pathname: '/(features)/verification' });
    expect(notificationRoute('wallet', 'account-1')).toEqual({ pathname: '/(tabs)/wallet' });
    expect(notificationRoute('unknown', 'secret')).toEqual({ pathname: '/(features)/notifications' });
  });
});
