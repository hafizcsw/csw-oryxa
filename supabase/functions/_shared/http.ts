export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export function preflight(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return null;
}
