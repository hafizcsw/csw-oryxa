import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEffectiveUniversityPageAccess } from "../_shared/universityPageAccess.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Authenticate user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonRes({ ok: false, error: 'NO_AUTH' }, 401);

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return jsonRes({ ok: false, error: 'INVALID_TOKEN' }, 401);

  const body = await req.json();
  const { action } = body;

  async function isUniversityPageLaneEnabled() {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'university_page_os_lane_enabled')
      .maybeSingle();
    return data?.enabled !== false;
  }

  // Helper: check if user is admin
  async function isAdmin(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('is_admin', { _user_id: userId });
      return data === true;
    } catch {
      return false;
    }
  }

  try {
    switch (action) {
      // ── Submit a page edit proposal ──
      case 'submit': {
        const { university_id, block_type, payload } = body;
        if (!university_id || !block_type || !payload) {
          return jsonRes({ ok: false, error: 'Missing required fields' }, 400);
        }
        if (!['about', 'gallery', 'cover', 'logo', 'contact', 'social'].includes(block_type)) {
          return jsonRes({ ok: false, error: 'Invalid block_type' }, 400);
        }

        const laneEnabled = await isUniversityPageLaneEnabled();
        if (!laneEnabled) {
          return jsonRes({ ok: false, error: 'PAGE_LANE_DISABLED' }, 503);
        }

        // ── RESOLVED EFFECTIVE ACCESS — not raw claims ──
        const access = await resolveEffectiveUniversityPageAccess(supabase, user.id, university_id);

        if (!access.granted) {
          return jsonRes({
            ok: false,
            error: 'ACCESS_DENIED',
            reason: access.reason,
          }, 403);
        }

        // ── AUTO-PUBLISH for verified users (super admin or approved claim) ──
        const userIsAdmin = await isAdmin(user.id);
        const autoPublish = userIsAdmin || access.isVerified;

        const editStatus = autoPublish ? 'published' : 'pending';
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('institution_page_edits')
          .insert({
            university_id,
            submitted_by: user.id,
            block_type,
            payload,
            status: editStatus,
            ...(autoPublish ? {
              reviewer_id: user.id,
              reviewed_at: now,
              published_at: now,
            } : {}),
          })
          .select()
          .single();

        if (error) return jsonRes({ ok: false, error: error.message }, 400);

        // ── If auto-publish, apply to canonical truth immediately ──
        if (autoPublish) {
          if (block_type === 'cover') {
            const nextCover = typeof payload.cover_image_url === 'string' ? payload.cover_image_url : null;
            if (nextCover) {
              const { data: before } = await supabase
                .from('universities')
                .select('hero_image_url')
                .eq('id', university_id)
                .single();

              await supabase
                .from('universities')
                .update({ hero_image_url: nextCover })
                .eq('id', university_id);

              try {
                await supabase.from('page_mutation_history').insert({
                  university_id,
                  mutation_type: 'cover',
                  before_payload: { hero_image_url: before?.hero_image_url ?? null },
                  after_payload: { hero_image_url: nextCover },
                  proposal_id: data.id,
                  actor_user_id: user.id,
                });
              } catch { /* non-blocking */ }
            }
          } else if (block_type === 'logo') {
            const nextLogo = typeof payload.logo_url === 'string' ? payload.logo_url : null;
            if (nextLogo) {
              const { data: before } = await supabase
                .from('universities')
                .select('logo_url')
                .eq('id', university_id)
                .single();

              await supabase
                .from('universities')
                .update({ logo_url: nextLogo })
                .eq('id', university_id);

              try {
                await supabase.from('page_mutation_history').insert({
                  university_id,
                  mutation_type: 'logo',
                  before_payload: { logo_url: before?.logo_url ?? null },
                  after_payload: { logo_url: nextLogo },
                  proposal_id: data.id,
                  actor_user_id: user.id,
                });
              } catch { /* non-blocking */ }
            }
          } else if (block_type === 'contact') {
            // Contact fields: phone, email, website
            const contactFields: Record<string, unknown> = {};
            const allowedContactKeys = ['phone', 'email', 'website'];
            for (const key of allowedContactKeys) {
              if (payload[key] !== undefined) contactFields[key] = payload[key];
            }
            if (Object.keys(contactFields).length > 0) {
              const { data: before } = await supabase
                .from('universities')
                .select('phone, email, website')
                .eq('id', university_id)
                .single();

              await supabase
                .from('universities')
                .update(contactFields)
                .eq('id', university_id);

              try {
                await supabase.from('page_mutation_history').insert({
                  university_id,
                  mutation_type: 'contact',
                  before_payload: before || {},
                  after_payload: contactFields,
                  proposal_id: data.id,
                  actor_user_id: user.id,
                });
              } catch { /* non-blocking */ }
            }
          } else if (block_type === 'social') {
            // Social links update (merges into social_links JSONB)
            const socialUpdates = payload.social_links as Record<string, string | null> | undefined;
            if (socialUpdates && typeof socialUpdates === 'object') {
              const { data: current } = await supabase
                .from('universities')
                .select('social_links')
                .eq('id', university_id)
                .single();

              const merged = { ...(current?.social_links as Record<string, unknown> || {}), ...socialUpdates };

              await supabase
                .from('universities')
                .update({ social_links: merged })
                .eq('id', university_id);

              try {
                await supabase.from('page_mutation_history').insert({
                  university_id,
                  mutation_type: 'social',
                  before_payload: { social_links: current?.social_links ?? {} },
                  after_payload: { social_links: merged },
                  proposal_id: data.id,
                  actor_user_id: user.id,
                });
              } catch { /* non-blocking */ }
            }
          }
        }

        // Log activity (best-effort)
        try {
          await supabase.from('page_activity_log').insert({
            university_id,
            actor_user_id: user.id,
            action_type: autoPublish ? 'auto_published' : 'proposal_submitted',
            target_type: block_type,
            target_id: data.id,
            metadata: { block_type, auto_published: autoPublish },
          });
        } catch { /* non-blocking */ }

        return jsonRes({ ok: true, edit: data, auto_published: autoPublish });
      }

      // ── List edits for a university (institution user sees own, admin sees all) ──
      case 'list': {
        const { university_id, status: filterStatus } = body;
        if (!university_id) return jsonRes({ ok: false, error: 'Missing university_id' }, 400);

        const admin = await isAdmin(user.id);
        let query = supabase
          .from('institution_page_edits')
          .select('*')
          .eq('university_id', university_id)
          .order('created_at', { ascending: false });

        if (!admin) {
          query = query.eq('submitted_by', user.id);
        }
        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }

        const { data, error } = await query;
        if (error) return jsonRes({ ok: false, error: error.message }, 400);
        return jsonRes({ ok: true, edits: data || [] });
      }

      // ── Admin: list all pending edits across all universities ──
      case 'list_pending': {
        if (!(await isAdmin(user.id))) {
          return jsonRes({ ok: false, error: 'ADMIN_ONLY' }, 403);
        }

        const { data, error } = await supabase
          .from('institution_page_edits')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (error) return jsonRes({ ok: false, error: error.message }, 400);
        return jsonRes({ ok: true, edits: data || [] });
      }

      // ── Admin: approve an edit → publish to canonical truth ──
      case 'approve': {
        const { edit_id, review_notes } = body;
        if (!edit_id) return jsonRes({ ok: false, error: 'Missing edit_id' }, 400);

        if (!(await isAdmin(user.id))) {
          return jsonRes({ ok: false, error: 'ADMIN_ONLY' }, 403);
        }

        // Get the edit
        const { data: edit, error: fetchErr } = await supabase
          .from('institution_page_edits')
          .select('*')
          .eq('id', edit_id)
          .single();

        if (fetchErr || !edit) return jsonRes({ ok: false, error: 'Edit not found' }, 404);
        if (edit.status !== 'pending') return jsonRes({ ok: false, error: 'Edit is not pending' }, 400);

        // ── PUBLISH TO CANONICAL TRUTH ──
        const payload = edit.payload as Record<string, unknown>;

        if (edit.block_type === 'about') {
          const updateFields: Record<string, unknown> = {};
          if (payload.about_text !== undefined) updateFields.about_text = payload.about_text;
          if (payload.description !== undefined) updateFields.description = payload.description;
          if (payload.description_ar !== undefined) updateFields.description_ar = payload.description_ar;

          if (Object.keys(updateFields).length > 0) {
            const { error: updateErr } = await supabase
              .from('universities')
              .update(updateFields)
              .eq('id', edit.university_id);
            if (updateErr) return jsonRes({ ok: false, error: `Publish failed: ${updateErr.message}` }, 500);
          }
        } else if (edit.block_type === 'gallery') {
          const images = (payload.images || []) as Array<{ url: string; alt_text?: string; sort_order?: number }>;
          if (images.length > 0) {
            const rows = images.map((img, i) => ({
              university_id: edit.university_id,
              image_type: 'gallery',
              media_kind: 'image',
              public_url: img.url,
              source_url: img.url,
              source_page_url: '',
              alt_text: img.alt_text || null,
              sort_order: img.sort_order ?? (100 + i),
              source_name: 'institution_upload',
            }));
            const { error: mediaErr } = await supabase
              .from('university_media')
              .insert(rows);
            if (mediaErr) return jsonRes({ ok: false, error: `Gallery publish failed: ${mediaErr.message}` }, 500);
          }
        } else if (edit.block_type === 'cover') {
          const nextCover = typeof payload.cover_image_url === 'string' ? payload.cover_image_url : null;
          if (!nextCover) return jsonRes({ ok: false, error: 'Missing cover_image_url payload' }, 400);

          const { data: before } = await supabase
            .from('universities')
            .select('hero_image_url')
            .eq('id', edit.university_id)
            .single();

          const { error: coverErr } = await supabase
            .from('universities')
            .update({ hero_image_url: nextCover })
            .eq('id', edit.university_id);
          if (coverErr) return jsonRes({ ok: false, error: `Cover publish failed: ${coverErr.message}` }, 500);

          try {
            await supabase.from('page_mutation_history').insert({
              university_id: edit.university_id,
              mutation_type: 'cover',
              before_payload: { hero_image_url: before?.hero_image_url ?? null },
              after_payload: { hero_image_url: nextCover },
              proposal_id: edit.id,
              actor_user_id: user.id,
            });
          } catch { /* non-blocking */ }
        } else if (edit.block_type === 'logo') {
          const nextLogo = typeof payload.logo_url === 'string' ? payload.logo_url : null;
          if (!nextLogo) return jsonRes({ ok: false, error: 'Missing logo_url payload' }, 400);

          const { data: before } = await supabase
            .from('universities')
            .select('logo_url')
            .eq('id', edit.university_id)
            .single();

          const { error: logoErr } = await supabase
            .from('universities')
            .update({ logo_url: nextLogo })
            .eq('id', edit.university_id);
          if (logoErr) return jsonRes({ ok: false, error: `Logo publish failed: ${logoErr.message}` }, 500);

          try {
            await supabase.from('page_mutation_history').insert({
              university_id: edit.university_id,
              mutation_type: 'logo',
              before_payload: { logo_url: before?.logo_url ?? null },
              after_payload: { logo_url: nextLogo },
              proposal_id: edit.id,
              actor_user_id: user.id,
            });
          } catch { /* non-blocking */ }
        } else if (edit.block_type === 'contact') {
          const contactFields: Record<string, unknown> = {};
          const allowedContactKeys = ['phone', 'email', 'website'];
          for (const key of allowedContactKeys) {
            if (payload[key] !== undefined) contactFields[key] = payload[key];
          }
          if (Object.keys(contactFields).length > 0) {
            const { error: contactErr } = await supabase
              .from('universities')
              .update(contactFields)
              .eq('id', edit.university_id);
            if (contactErr) return jsonRes({ ok: false, error: `Contact publish failed: ${contactErr.message}` }, 500);
          }
        } else if (edit.block_type === 'social') {
          const socialUpdates = payload.social_links as Record<string, string | null> | undefined;
          if (socialUpdates && typeof socialUpdates === 'object') {
            const { data: current } = await supabase
              .from('universities')
              .select('social_links')
              .eq('id', edit.university_id)
              .single();
            const merged = { ...(current?.social_links as Record<string, unknown> || {}), ...socialUpdates };
            const { error: socialErr } = await supabase
              .from('universities')
              .update({ social_links: merged })
              .eq('id', edit.university_id);
            if (socialErr) return jsonRes({ ok: false, error: `Social publish failed: ${socialErr.message}` }, 500);
          }
        }

        // Mark edit as published
        const { error: statusErr } = await supabase
          .from('institution_page_edits')
          .update({
            status: 'published',
            reviewer_id: user.id,
            review_notes: review_notes || null,
            reviewed_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
          })
          .eq('id', edit_id);

        if (statusErr) return jsonRes({ ok: false, error: statusErr.message }, 500);

        // Log activity (best-effort)
        try {
          await supabase.from('page_activity_log').insert({
            university_id: edit.university_id,
            actor_user_id: user.id,
            action_type: 'proposal_approved',
            target_type: edit.block_type,
            target_id: edit.id,
            metadata: { review_notes: review_notes || null },
          });
        } catch { /* non-blocking */ }

        return jsonRes({ ok: true, published: true });
      }

      // ── Admin: reject an edit ──
      case 'reject': {
        const { edit_id, review_notes } = body;
        if (!edit_id) return jsonRes({ ok: false, error: 'Missing edit_id' }, 400);

        if (!(await isAdmin(user.id))) {
          return jsonRes({ ok: false, error: 'ADMIN_ONLY' }, 403);
        }

        const { data: edit } = await supabase
          .from('institution_page_edits')
          .select('university_id, block_type')
          .eq('id', edit_id)
          .single();

        const { error } = await supabase
          .from('institution_page_edits')
          .update({
            status: 'rejected',
            reviewer_id: user.id,
            review_notes: review_notes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', edit_id)
          .eq('status', 'pending');

        if (error) return jsonRes({ ok: false, error: error.message }, 400);

        try {
          await supabase.from('page_activity_log').insert({
            university_id: edit?.university_id,
            actor_user_id: user.id,
            action_type: 'proposal_rejected',
            target_type: edit?.block_type || 'edit',
            target_id: edit_id,
            metadata: { review_notes: review_notes || null },
          });
        } catch { /* non-blocking */ }

        return jsonRes({ ok: true });
      }

      default:
        return jsonRes({ ok: false, error: 'Unknown action' }, 400);
    }
  } catch (err) {
    return jsonRes({ ok: false, error: (err as Error).message }, 500);
  }
});
