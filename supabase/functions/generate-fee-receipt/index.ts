// Generates a PDF receipt for a fee payment, uploads it to fee-receipts bucket,
// and returns a signed URL. Also patches the payment row with receipt_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  payment_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payment_id } = (await req.json()) as Body;
    if (!payment_id || typeof payment_id !== "string") {
      return new Response(JSON.stringify({ error: "payment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load payment + related records
    const { data: pay, error: payErr } = await admin
      .from("fee_payments")
      .select("id, school_id, student_id, amount_paid, payment_date, payment_mode, receipt_number, for_month, note, fee_structure_id")
      .eq("id", payment_id)
      .maybeSingle();

    if (payErr || !pay) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller must be admin in same school
    const { data: callerProfile } = await admin
      .from("profiles").select("school_id").eq("user_id", user.id).maybeSingle();
    if (!callerProfile || callerProfile.school_id !== pay.school_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("school_id", pay.school_id).eq("role", "school_admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: school }, { data: student }, { data: structure }] = await Promise.all([
      admin.from("schools").select("name, city, state, email").eq("id", pay.school_id).maybeSingle(),
      admin.from("students").select("name, admission_number").eq("id", pay.student_id).maybeSingle(),
      pay.fee_structure_id
        ? admin.from("fee_structures").select("name").eq("id", pay.fee_structure_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ----- Build PDF -----
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(225, 29, 72); // brand-600 #e11d48
    doc.rect(0, 0, pageW, 80, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text(school?.name ?? "School", 40, 38);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text([school?.city, school?.state].filter(Boolean).join(", ") || " ", 40, 58);
    if (school?.email) doc.text(school.email, 40, 72);

    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("FEE RECEIPT", pageW - 40, 38, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`No. ${pay.receipt_number ?? pay.id.slice(0, 8).toUpperCase()}`, pageW - 40, 58, { align: "right" });
    doc.text(new Date(pay.payment_date ?? new Date()).toLocaleDateString(), pageW - 40, 72, { align: "right" });

    // Body
    doc.setTextColor(20, 25, 40);
    let y = 130;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Received from", 40, y);
    doc.setFont("helvetica", "normal"); doc.text(student?.name ?? "—", 160, y);
    y += 20;
    doc.setFont("helvetica", "bold"); doc.text("Admission #", 40, y);
    doc.setFont("helvetica", "normal"); doc.text(student?.admission_number ?? "—", 160, y);
    y += 20;
    doc.setFont("helvetica", "bold"); doc.text("Fee Category", 40, y);
    doc.setFont("helvetica", "normal"); doc.text(structure?.name ?? "General fee", 160, y);
    if (pay.for_month) {
      y += 20;
      doc.setFont("helvetica", "bold"); doc.text("For period", 40, y);
      doc.setFont("helvetica", "normal"); doc.text(pay.for_month, 160, y);
    }
    y += 20;
    doc.setFont("helvetica", "bold"); doc.text("Payment mode", 40, y);
    doc.setFont("helvetica", "normal"); doc.text(String(pay.payment_mode ?? "cash").toUpperCase(), 160, y);
    if (pay.note) {
      y += 20;
      doc.setFont("helvetica", "bold"); doc.text("Note", 40, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(pay.note, pageW - 200);
      doc.text(lines, 160, y);
      y += (lines.length - 1) * 14;
    }

    // Amount block
    y += 40;
    doc.setFillColor(250, 232, 238);
    doc.roundedRect(40, y, pageW - 80, 70, 8, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(120, 20, 50);
    doc.text("Amount received", 60, y + 30);
    doc.setFontSize(22);
    doc.text(`INR ${Number(pay.amount_paid).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageW - 60, y + 40, { align: "right" });

    // Footer
    doc.setTextColor(120, 120, 130); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("This is a computer-generated receipt. Thank you for your payment.", 40, doc.internal.pageSize.getHeight() - 40);

    const pdfArrayBuffer = doc.output("arraybuffer");
    const bytes = new Uint8Array(pdfArrayBuffer);

    const fileName = `${pay.receipt_number ?? pay.id}.pdf`;
    const filePath = `${pay.school_id}/${pay.student_id}/${fileName}`;

    const { error: upErr } = await admin.storage
      .from("fee-receipts")
      .upload(filePath, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${upErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save path to payment for later retrieval
    await admin.from("fee_payments").update({ receipt_url: filePath }).eq("id", pay.id);

    // Return signed URL for immediate download
    const { data: signed } = await admin.storage
      .from("fee-receipts")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

    return new Response(JSON.stringify({ path: filePath, signed_url: signed?.signedUrl ?? null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
