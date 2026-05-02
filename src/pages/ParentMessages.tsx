import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Msg { id: string; sender_id: string; receiver_id: string; body: string; created_at: string; is_read: boolean; student_id: string }

export default function ParentMessages() {
  const { user, school } = useAuth();
  const { activeChild } = useChild();
  const [teacherUserId, setTeacherUserId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // resolve class teacher's auth user_id from sections.class_teacher_id (profiles.id)
  useEffect(() => {
    if (!activeChild?.section_id) { setTeacherUserId(null); return; }
    (async () => {
      const { data: sec } = await supabase
        .from("sections")
        .select("class_teacher_id")
        .eq("id", activeChild.section_id!)
        .maybeSingle();
      const profId = (sec as any)?.class_teacher_id;
      if (!profId) { setTeacherUserId(null); setTeacherName(null); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("id", profId)
        .maybeSingle();
      setTeacherUserId((prof as any)?.user_id ?? null);
      setTeacherName((prof as any)?.name ?? null);
    })();
  }, [activeChild?.section_id]);

  // load messages + realtime
  useEffect(() => {
    if (!user?.id || !activeChild?.id) { setMessages([]); return; }
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("student_id", activeChild.id)
        .order("created_at", { ascending: true });
      if (active) setMessages((data ?? []) as Msg[]);
    };
    load();
    const ch = supabase
      .channel(`msg-${activeChild.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `student_id=eq.${activeChild.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user?.id, activeChild?.id]);

  // mark inbound as read
  useEffect(() => {
    if (!user?.id || !activeChild?.id) return;
    const unread = messages.filter((m) => m.receiver_id === user.id && !m.is_read);
    if (unread.length === 0) return;
    supabase.from("messages").update({ is_read: true }).in("id", unread.map((m) => m.id)).then(() => {});
  }, [messages, user?.id, activeChild?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!user?.id || !school?.id || !activeChild?.id || !teacherUserId || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("messages").insert({
      school_id: school.id,
      sender_id: user.id,
      receiver_id: teacherUserId,
      student_id: activeChild.id,
      body: text,
    });
    if (error) toast.error(error.message);
  };

  if (!activeChild) return <div className="p-12 text-center text-sm text-muted-foreground">No child selected.</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {teacherName ? <>Chat with class teacher: <span className="font-medium text-foreground">{teacherName}</span></> : "Class teacher not yet assigned."}
        </p>
      </div>

      <Card className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Say hello to start the conversation.</p>
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
            placeholder={teacherUserId ? "Type a message…" : "Class teacher not assigned"}
            disabled={!teacherUserId}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <Button onClick={send} disabled={!teacherUserId || !body.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
