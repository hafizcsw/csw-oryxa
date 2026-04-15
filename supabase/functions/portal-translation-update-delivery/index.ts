import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[UPDATE-DELIVERY] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { order_id, delivery_destination, delivery_address, notification_channels } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate delivery_destination
    const validDestinations = ['university', 'dormitory', 'embassy', 'digital'];
    if (delivery_destination && !validDestinations.includes(delivery_destination)) {
      return new Response(
        JSON.stringify({ error: 'Invalid delivery_destination' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order ownership
    const { data: order, error: orderError } = await supabase
      .from('notarized_translation_orders')
      .select('id, customer_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[UPDATE-DELIVERY] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.customer_id !== user.id) {
      console.error('[UPDATE-DELIVERY] Ownership mismatch:', { customer_id: order.customer_id, user_id: user.id });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    
    if (delivery_destination) {
      updateData.delivery_destination = delivery_destination;
    }
    
    if (delivery_address !== undefined) {
      updateData.delivery_address = delivery_address;
    }
    
    if (notification_channels !== undefined) {
      updateData.notification_channels = notification_channels;
    }

    // Calculate estimated completion time (24-48 hours for digital, +3-5 days for physical)
    const baseHours = 48;
    const physicalDays = delivery_destination !== 'digital' ? 5 : 0;
    const estimatedCompletion = new Date();
    estimatedCompletion.setHours(estimatedCompletion.getHours() + baseHours);
    estimatedCompletion.setDate(estimatedCompletion.getDate() + physicalDays);
    updateData.estimated_completion_at = estimatedCompletion.toISOString();

    console.log('[UPDATE-DELIVERY] Updating order:', { order_id, updateData });

    // Update the order
    const { error: updateError } = await supabase
      .from('notarized_translation_orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error('[UPDATE-DELIVERY] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[UPDATE-DELIVERY] Success:', { order_id, delivery_destination });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        order_id,
        delivery_destination,
        estimated_completion_at: updateData.estimated_completion_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UPDATE-DELIVERY] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
