const GSC_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function base64url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwt(header: object, claim: object, privateKeyPem: string) {
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const claimB64 = base64url(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;

  // Import RSA key from PEM
  const pkcs8 = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const keyBytes = Uint8Array.from(atob(pkcs8), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const sigB64 = base64url(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

export async function getGscAccessToken(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: GSC_TOKEN_URL,
    exp: now + 3600,
    iat: now
  };
  const jwt = await signJwt({ alg: "RS256", typ: "JWT" }, claim, privateKey);

  const res = await fetch(GSC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ 
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", 
      assertion: jwt 
    })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`GSC token error: ${res.status} ${JSON.stringify(j)}`);
  return j.access_token as string;
}

export async function fetchSearchAnalytics(
  property: string, 
  startDate: string, 
  endDate: string, 
  token: string
) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  
  const post = (rowLimit: number, dimension?: 'query' | 'page') => 
    fetch(endpoint, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        startDate, 
        endDate,
        dimensions: dimension ? [dimension] : [],
        rowLimit
      })
    }).then(r => r.json());

  const [summary, q, p] = await Promise.all([
    post(1), 
    post(25, "query"), 
    post(25, "page")
  ]);

  const clicks = (summary?.rows || []).reduce((a: any, r: any) => a + (r.clicks || 0), 0);
  const impressions = (summary?.rows || []).reduce((a: any, r: any) => a + (r.impressions || 0), 0);
  const ctr = impressions ? +((clicks / impressions) * 100).toFixed(2) : 0;
  const position = +(summary?.rows?.[0]?.position ?? 0).toFixed(2);

  const top_queries = (q?.rows || []).map((r: any) => ({
    q: r.keys?.[0],
    clicks: r.clicks,
    imp: r.impressions,
    ctr: +(r.ctr * 100).toFixed(2),
    pos: +r.position.toFixed(2)
  }));

  const top_pages = (p?.rows || []).map((r: any) => ({
    url: r.keys?.[0],
    clicks: r.clicks,
    imp: r.impressions,
    ctr: +(r.ctr * 100).toFixed(2),
    pos: +r.position.toFixed(2)
  }));

  return { clicks, impressions, ctr, position, top_queries, top_pages };
}
