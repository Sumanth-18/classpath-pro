import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { identifier, password } = await req.json();
    if (!identifier || !password || typeof identifier !== "string" || typeof password !== "string") {
      return json({ error: "Identifier and password required" }, 400);
    }

    const id = identifier.trim();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let email: string | null = null;
    const digitsOnly = id.replace(/\D/g, "");
    const isPhone = digitsOnly.length >= 7 && /^[\d+\s-]+$/.test(id);

    if (isPhone) {
      // Look up parent profile by phone (try several phone formats)
      const candidates = Array.from(new Set([id, digitsOnly, digitsOnly.slice(-10)]));
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, email, phone")
        .in("phone", candidates);

      if (profs && profs.length) {
        // Verify role is parent
        const userIds = profs.map((p: any) => p.user_id);
        const { data: roles } = await admin
          .from("user_roles")
          .select("user_id")
          .in("user_id", userIds)
          .eq("role", "parent");
        const parentIds = new Set((roles ?? []).map((r: any) => r.user_id));
        const match = profs.find((p: any) => parentIds.has(p.user_id));
        if (match?.email) email = match.email;
      }
    } else {
      // Treat as admission number
      const { data: students } = await admin
        .from("students")
        .select("id")
        .ilike("admission_number", id)
        .limit(1);
      const student = students?.[0];
      if (student) {
        const { data: links } = await admin
          .from("parent_student")
          .select("parent_user_id")
          .eq("student_id", student.id)
          .limit(1);
        const parentUserId = links?.[0]?.parent_user_id;
        if (parentUserId) {
          const { data: prof } = await admin
            .from("profiles")
            .select("email")
            .eq("user_id", parentUserId)
            .maybeSingle();
          if (prof?.email) email = prof.email;
        }
      }
    }

    if (!email) {
      return json({ error: "Invalid credentials" }, 401);
    }

    // Sign in via anon client
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return json({ error: "Invalid credentials" }, 401);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (e) {
    console.error("parent-login error", e);
    return json({ error: "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
