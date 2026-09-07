// Vercel serverless function — runs server-side (Node), so CORS does not apply here.
// This is the piece that makes real GoPlus data possible: the browser calls this
// endpoint (/api/check?address=...), and THIS function calls GoPlus on the server,
// then hands the JSON back to the browser.
//
// Docs for the underlying API: https://docs.gopluslabs.io/reference/solanatokensecurityusingget

const GOPLUS_ENDPOINT = "https://api.gopluslabs.io/api/v1/solana/token_security";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { address } = req.query;
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'address' query parameter" });
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: "Address doesn't look like a valid Solana address" });
  }

  try {
    const url = `${GOPLUS_ENDPOINT}?contract_addresses=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `GoPlus responded with ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("GoPlus fetch failed:", err);
    return res.status(502).json({ error: "Could not reach GoPlus from the server" });
  }
}
