export async function POST() {
  return new Response(JSON.stringify({ error: "Use /auth/callback for Google OAuth" }), { status: 405 });
}
