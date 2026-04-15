import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadinessPipeline } from '@/components/readiness/ReadinessPipeline';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

describe('readiness pipeline honesty', () => {
  it('shows no-data state when no real aggregation is provided', () => {
    render(<ReadinessPipeline />);
    expect(screen.getByText('pipeline.no_data')).toBeInTheDocument();
    expect(screen.queryByText('pipeline.segment.ready_now')).not.toBeInTheDocument();
  });
});
