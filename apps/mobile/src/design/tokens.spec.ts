import { colors, controls, layout, radius, spacing, typography } from './tokens';

describe('mobile design tokens', () => {
  it('keeps the Campus Emerald and slate palette from DESIGN.md', () => {
    expect(colors.campusEmerald).toBe('#059669');
    expect(colors.mist).toBe('#f8fafc');
    expect(colors.ink).toBe('#0f172a');
  });

  it('keeps controls touchable and page layout mobile-first', () => {
    expect(controls.minTouchTarget).toBeGreaterThanOrEqual(44);
    expect(controls.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(layout.pageHorizontal).toBe(spacing.lg);
    expect(layout.contentMaxWidth).toBeGreaterThan(360);
  });

  it('uses a shared typography and geometry scale', () => {
    expect(typography.body.fontSize).toBe(16);
    expect(typography.title.fontSize).toBeGreaterThan(typography.heading.fontSize);
    expect(radius.card).toBe(16);
    expect(radius.pill).toBeGreaterThan(radius.card);
  });
});
