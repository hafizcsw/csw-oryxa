import { corsHeaders } from '../_shared/auth.ts';
import { requireAdmin } from '../_shared/adminGuard.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const check = await requireAdmin(req);
    if (!check.ok) {
      return new Response(
        JSON.stringify({ error: check.error }),
        { status: check.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = check.srv;

    // Get users list
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (usersError) {
      console.error('[admin-users-list] Users error:', usersError);
      return new Response(
        JSON.stringify({ error: usersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get details for a specific user if user_id is provided
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (userId) {
      // Load applications
      const { data: apps } = await supabase
        .from('applications')
        .select('id, created_at, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Load favorites with program details
      const { data: favs } = await supabase
        .from('user_shortlists')
        .select('program_id, programs(title)')
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({
          user: users?.find(u => u.user_id === userId),
          applications: apps || [],
          favorites: favs || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ users: users || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-users-list] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
