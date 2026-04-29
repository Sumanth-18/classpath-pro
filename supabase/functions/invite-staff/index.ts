import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteBody {
  name: string;
  email: string;
  phone?: string | null;
  role: "teacher" | "school_admin";
  school_id: string;
  designation?: string | null;
  department?: string | null;
  employee_id?: string | null;
  date_of_joining?: string | null;
  salary?: number | null;
  resend?: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller-scoped client for auth verification
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    const body = (await req.json()) as InviteBody;
    const {
      name,
      email,
      phone,
      role,
      school_id,
      designation,
      department,
      employee_id,
      date_of_joining,
      salary,
      resend,
    } = body;

    if (!name?.trim() || !email?.trim() || !school_id || !role) {
      return json({ error: "name, email, role and school_id are required" }, 400);
    }
    if (role !== "teacher" && role !== "school_admin") {
      return json({ error: "Invalid role" }, 400);
    }

    // Service-role client for privileged operations
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Verify caller is school_admin of the target school
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("school_id", school_id)
      .eq("role", "school_admin");
    if (!callerRoles || callerRoles.length === 0) {
      return json({ error: "Not a school admin of this school" }, 403);
    }

    const emailNorm = email.trim().toLowerCase();

    // Check if user already exists
    const { data: existingList } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    let existingUser = existingList?.users?.find(
      (u: any) => (u.email ?? "").toLowerCase() === emailNorm,
    );

    let userId: string;
    let invited = false;

    if (existingUser) {
      // Check if already in this school
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, school_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingProfile && existingProfile.school_id === school_id && !resend) {
        return json(
          { error: `${email} is already a member of this school` },
          409,
        );
      }

      userId = existingUser.id;

      if (resend) {
        // Re-send invite link
        const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
          emailNorm,
          {
            data: { name: name.trim(), role, school_id },
          },
        );
        if (inviteErr && !inviteErr.message?.toLowerCase().includes("already")) {
          return json({ error: inviteErr.message }, 400);
        }
        invited = true;
      }
    } else {
      // Brand new invite
      const { data: invite, error: inviteErr } = await admin.auth.admin
        .inviteUserByEmail(emailNorm, {
          data: { name: name.trim(), role, school_id },
        });
      if (inviteErr || !invite?.user) {
        return json(
          { error: inviteErr?.message ?? "Failed to send invite" },
          400,
        );
      }
      userId = invite.user.id;
      invited = true;
    }

    // Case-insensitive employee_id duplicate check (exclude this user's own row)
    if (employee_id?.trim()) {
      const empLower = employee_id.trim().toLowerCase();
      const { data: dupes } = await admin
        .from("staff_profiles")
        .select("id, employee_id, user_id")
        .eq("school_id", school_id);
      const conflict = (dupes ?? []).find(
        (d: any) =>
          (d.employee_id ?? "").toLowerCase() === empLower &&
          d.user_id !== userId,
      );
      if (conflict) {
        return json({ error: `Employee ID "${employee_id}" already exists` }, 409);
      }
    }

    // The handle_new_user trigger creates profile + user_role rows.
    // Update profile with extra fields and mark as invited.
    await admin
      .from("profiles")
      .update({
        name: name.trim(),
        email: emailNorm,
        phone: phone?.trim() || null,
        school_id,
        invite_status: "invited",
        invited_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Ensure correct role exists
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("school_id", school_id);
    await admin.from("user_roles").insert({
      user_id: userId,
      school_id,
      role,
    });

    // Upsert staff_profiles
    const { data: existingStaff } = await admin
      .from("staff_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("school_id", school_id)
      .maybeSingle();

    const staffPayload = {
      school_id,
      user_id: userId,
      designation: designation?.trim() || null,
      department: department || null,
      employee_id: employee_id?.trim() || null,
      date_of_joining: date_of_joining || null,
      salary: salary ?? null,
    };

    if (existingStaff) {
      await admin
        .from("staff_profiles")
        .update(staffPayload)
        .eq("id", existingStaff.id);
    } else {
      const { error: sErr } = await admin
        .from("staff_profiles")
        .insert(staffPayload);
      if (sErr) return json({ error: sErr.message }, 400);
    }

    return json({ user_id: userId, status: "invited", invited });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
