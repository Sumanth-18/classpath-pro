import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface Conversation {
  student_id: string;
  student_name: string;
  parent_user_id: string;
  parent_name: string;
  unread: number;
  last_at: string | null;
}

interface Msg {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  is_read: boolean;
  student_id: string;
}

export default function TeacherMessages() {
  const { user, profile, school } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeStudent, setActiveStudent] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // load conversations: students in sections where I'm class teacher
  useEffect(() => {
    if (!user?.id || !profile?.id || !school?.id) return;
    (async () => {
      // sections I am class teacher of
      const { data: secs } = await supabase
        .from("sections")
        .select("id")
        .eq("school_id", school.id)
        .eq("class_teacher_id", profile.id);
      const sectionIds = (secs ?? []).map((s: any) => s.id);
      if (sectionIds.length === 0) { setConvos([]); return; }

      const { data: studs } = await supabase
        .from("students")
        .select("id, name, section_id")
        .in("section_id", sectionIds)
        .eq("is_active", true);
      const studentIds = (studs ?? []).map((s: any) => s.id);
      if (studentIds.length === 0) { setConvos([]); return; }

      const [{ data: links }, { data: msgs }] = await Promise.all([
        supabase.from("parent_student").select("parent_user_id, student_id").in("student_id", studentIds),
        supabase.from("messages").select("id, sender_id, receiver_id, student_id, is_read, created_at")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false }),
      ]);

      // resolve parent profiles
      const parentIds = Array.from(new Set((links ?? []).map((l: any) => l.parent_user_id)));
      const { data: parentProfiles } = parentIds.length
        ? await supabase.from("profiles").select("user_id, name").in("user_id", parentIds)
        : { data: [] as any[] };
      const parentName = new Map<string, string>();
      (parentProfiles ?? []).forEach((p: any) => parentName.set(p.user_id, p.name));

      const studentName = new Map<string, string>();
      (studs ?? []).forEach((s: any) => studentName.set(s.id, s.name));

      const list: Conversation[] = [];
      (links ?? []).forEach((l: any) => {
        const childMsgs = (msgs ?? []).filter((m: any) => m.student_id === l.student_id);
        const unread = childMsgs.filter((m: any) => m.receiver_id === user.id && !m.is_read).length;
        list.push({
          student_id: l.student_id,
          student_name: studentName.get(l.student_id) ?? "—",
          parent_user_id: l.parent_user_id,
          parent_name: parentName.get(l.parent_user_id) ?? "Parent",
          unread,
          last_at: childMsgs[0]?.created_at ?? null,
        });
      });
      list.sort((a, b) => (b.last_at ?? "").localeCompare(a.last_at ?? ""));
      setConvos(list);
      if (list.length && !activeStudent) setActiveStudent(list[0]);
    })();
    // eslint-disable-next-line
  }, [user?.id, profile?.id, school?.id]);

  // load messages for active conversation + realtime
  useEffect(() => {
    if (!activeStudent?.student_id) { setMessages([]); return; }
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("student_id", activeStudent.student_id)
        .order("created_at", { ascending: true });
      if (active) setMessages((data ?? []) as Msg[]);
    };
    load();
    const ch = supabase
      .channel(`tmsg-${activeStudent.student_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `student_id=eq.${activeStudent.student_id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [activeStudent?.student_id]);

  // mark read
  useEffect(() => {
    if (!user?.id || !activeStudent?.student_id) return;
    const unread = messages.filter((m) => m.receiver_id === user.id && !m.is_read);
    if (unread.length === 0) return;
    supabase.from("messages").update({ is_read: true }).in("id", unread.map((m) => m.id)).then(() => {});
  }, [messages, user?.id, activeStudent?.student_id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!user?.id || !school?.id || !activeStudent || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("messages").insert({
      school_id: school.id,
      sender_id: user.id,
      receiver_id: activeStudent.parent_user_id,
      student_id: activeStudent.student_id,
      body: text,
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground">Chat with parents of your class</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[70vh]">
        <Card className="md:col-span-1 overflow-y-auto">
          {convos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No parents linked to your class yet.
            </div>
          ) : convos.map((c) => (
            <button
              key={c.student_id}
              onClick={() => setActiveStudent(c)}
              className={cn(
                "w-full text-left flex items-start gap-3 p-3 border-b hover:bg-muted/50 transition",
                activeStudent?.student_id === c.student_id && "bg-muted"
              )}
            >
              <div className="h-9 w-9 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{c.parent_name}</div>
                  {c.unread > 0 && (
                    <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.student_name}</div>
              </div>
            </button>
          ))}
        </Card>

        <Card className="md:col-span-2 flex flex-col">
          {!activeStudent ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b p-3">
                <div className="text-sm font-semibold">{activeStudent.parent_name}</div>
                <div className="text-xs text-muted-foreground">Parent of {activeStudent.student_name}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">No messages yet.</p>
                ) : messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {format(new Date(m.created_at), "p")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div className="border-t p-3 flex gap-2">
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type a message…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <Button onClick={send} disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
