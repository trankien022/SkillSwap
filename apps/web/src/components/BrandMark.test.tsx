import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark';

afterEach(() => {
  cleanup();
});

describe('BrandMark', () => {
  it('renders the shared logo image with an accessible name', () => {
    render(<BrandMark />);

    const logo = screen.getByAltText('SkillSwap');
    expect(logo).toBeDefined();
    expect(logo.getAttribute('src')).toContain('logo-skillswap-header.png');
  });

  it('applies the header-logo class so sizing comes from one place', () => {
    render(<BrandMark />);

    expect(screen.getByAltText('SkillSwap').className).toContain('header-logo');
  });

  it('merges caller classes without dropping header-logo', () => {
    render(<BrandMark className="shrink-0" />);

    const className = screen.getByAltText('SkillSwap').className;
    expect(className).toContain('header-logo');
    expect(className).toContain('shrink-0');
  });
});
