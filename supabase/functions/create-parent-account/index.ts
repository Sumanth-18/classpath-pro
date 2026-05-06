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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is school_admin and get their school_id
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("school_id")
      .eq("user_id", callerId)
      .maybeSingle();
    const schoolId = callerProfile?.school_id;
    if (!schoolId) return json({ error: "No school" }, 403);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("school_id", schoolId)
      .eq("role", "school_admin");
    if (!roleRows || roleRows.length === 0) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { student_id, parent_name, phone, email: providedEmail, password } = body ?? {};

    if (!student_id || !parent_name || !phone || !password) {
      return json({ error: "Missing fields" }, 400);
    }
    if (String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 7) return json({ error: "Invalid phone" }, 400);

    // Verify student belongs to caller's school
    const { data: student } = await admin
      .from("students")
      .select("id, school_id, name")
      .eq("id", student_id)
      .maybeSingle();
    if (!student || student.school_id !== schoolId) {
      return json({ error: "Student not found" }, 404);
    }

    const email = (providedEmail && String(providedEmail).trim()) ||
      `${digits}@parents.schoolos.local`;

    // Check if a parent with this phone already exists in school
    const { data: existing } = await admin
      .from("profiles")
      .select("user_id, email")
      .eq("school_id", schoolId)
      .eq("phone", digits)
      .maybeSingle();

    let parentUserId: string;
    let finalEmail = email;

    if (existing?.user_id) {
      parentUserId = existing.user_id;
      finalEmail = existing.email ?? email;
      // Update password
      await admin.auth.admin.updateUserById(parentUserId, { password });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: parent_name, role: "parent", school_id: schoolId },
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "Failed to create user" }, 400);
      }
      parentUserId = created.user.id;

      // Upsert profile (handle_new_user trigger may have created one)
      await admin.from("profiles").upsert(
        {
          user_id: parentUserId,
          school_id: schoolId,
          name: parent_name,
          email,
          phone: digits,
        },
        { onConflict: "user_id" }
      );

      await admin.from("user_roles").insert({
        user_id: parentUserId,
        school_id: schoolId,
        role: "parent",
      }).then(() => {}, () => {}); // ignore unique conflicts
    }

    // Ensure phone/name set on profile
    await admin
      .from("profiles")
      .update({ phone: digits, name: parent_name })
      .eq("user_id", parentUserId);

    // Link parent <-> student (idempotent)
    const { data: link } = await admin
      .from("parent_student")
      .select("id")
      .eq("parent_user_id", parentUserId)
      .eq("student_id", student_id)
      .maybeSingle();
    if (!link) {
      await admin.from("parent_student").insert({
        parent_user_id: parentUserId,
        student_id,
        relation: "parent",
      });
    }

    return json({
      ok: true,
      parent_user_id: parentUserId,
      email: finalEmail,
      phone: digits,
      admission_login_hint: `Parent can log in with phone ${digits} or the student's admission number.`,
    });
  } catch (e) {
    console.error("create-parent-account error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
