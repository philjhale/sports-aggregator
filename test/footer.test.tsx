import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers/renderApp';

describe('Footer', () => {
  it('attributes the data to ESPN and notes the app is unofficial and for personal use', () => {
    renderApp();

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(/data from ESPN/i);
    expect(footer).toHaveTextContent(/unofficial/i);
    expect(footer).toHaveTextContent(/personal use/i);
  });
});
