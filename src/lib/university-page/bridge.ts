import { supabase } from '@/integrations/supabase/client';
import type { UniversitySocialBridge } from './contracts';

const notActive = (area: string) => {
  throw new Error(`UNIVERSITY_PAGE_OS_PHASE_0_1_COVER_LOGO_ONLY:${area}`);
};

export const universitySocialBridge: UniversitySocialBridge = {
  async getUniversityPageMedia(universityId) {
    const { data: uni, error } = await supabase
      .from('universities')
      .select('hero_image_url, logo_url')
      .eq('id', universityId)
      .single();
    if (error) throw error;
    return {
      coverUrl: uni?.hero_image_url ?? null,
      logoUrl: uni?.logo_url ?? null,
    };
  },

  async updateUniversityPageCover(universityId, payload) {
    const { data, error } = await supabase.functions.invoke('institution-page-edit', {
      body: {
        action: 'submit',
        university_id: universityId,
        block_type: 'cover',
        payload: { cover_image_url: payload.coverImageUrl, governance_mode: payload.governanceMode ?? 'approval' },
      },
    });
    if (error) throw error;
    return { ok: !!data?.ok, proposalId: data?.edit?.id, autoPublished: !!data?.auto_published };
  },

  async updateUniversityPageLogo(universityId, payload) {
    const { data, error } = await supabase.functions.invoke('institution-page-edit', {
      body: {
        action: 'submit',
        university_id: universityId,
        block_type: 'logo',
        payload: { logo_url: payload.logoUrl, governance_mode: payload.governanceMode ?? 'approval' },
      },
    });
    if (error) throw error;
    return { ok: !!data?.ok, proposalId: data?.edit?.id, autoPublished: !!data?.auto_published };
  },

  async listUniversityPageMembers() { return notActive('members'); },
  async assignUniversityPageRole() { return notActive('assign-role'); },
  async revokeUniversityPageRole() { return notActive('revoke-role'); },
  async listUniversityPagePosts() { return notActive('posts'); },
  async createUniversityPagePost() { return notActive('create-post'); },
  async listUniversityInboxThreads() { return notActive('inbox-threads'); },
  async sendUniversityInboxReply() { return notActive('inbox-reply'); },
};
