import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok with the service name', () => {
    expect(new HealthController().health()).toEqual({ status: 'ok', service: 'gateway' });
  });
});
