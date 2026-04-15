import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GapCards } from '@/components/readiness/GapCards';
import { PrepServiceGrid } from '@/components/readiness/PrepServiceGrid';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

describe('gap -> service routing runtime proof', () => {
  it('fires exact service id from gap CTA and allows focused service highlight state', () => {
    const onServiceClick = vi.fn();
    render(
      <GapCards
        onServiceClick={onServiceClick}
        gaps={[
          {
            id: 'g1',
            category: 'english_test',
            title_key: 'readiness.gaps.english_test.title',
            description_key: 'readiness.gaps.english_test.description',
            severity: 'blocking',
            recommended_action_key: 'readiness.gaps.english_test.action',
            service_link: {
              service_id: 'ielts_prep',
              service_type: 'ielts_prep',
              label_key: 'readiness.services.ielts_prep',
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /readiness.services.ielts_prep/i }));
    expect(onServiceClick).toHaveBeenCalledWith('ielts_prep');

    render(<PrepServiceGrid focusedServiceId="ielts_prep" />);
    expect(screen.getByTestId('prep-service-ielts_prep')).toBeInTheDocument();
  });
});
