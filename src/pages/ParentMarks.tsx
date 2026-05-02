import { useEffect, useState } from "react";
import { useChild } from "@/contexts/ChildContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { jsPDF } from "jspdf";
import { toast } from "@/lib/toast";

interface Exam { id: string; name: string; start_date: string | null; end_date: string | null; published: boolean; class_id: string | null }
interface Mark { id: string; marks_obtained: number | null; max_marks: number | null; grade: string | null; subject_id: string; subjects: { name: string } | null }

export default function ParentMarks() {
  const { activeChild } = useChild();
  const { school } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeExam, setActiveExam] = useState<string>("");
  const [marks, setMarks] = useState<Mark[]>([]);

  useEffect(() => {
    if (!activeChild?.class_id || !school?.id) { setExams([]); return; }
    (async () => {
      const { data } = await supabase
        .from("exams")
        .select("id, name, start_date, end_date, published, class_id")
        .eq("school_id", school.id)
        .or(`class_id.eq.${activeChild.class_id},class_id.is.null`)
        .order("start_date", { ascending: false });
      const list = (data ?? []) as Exam[];
      setExams(list);
      if (list.length && !activeExam) setActiveExam(list[0].id);
    })();
  }, [activeChild?.class_id, school?.id]);

  useEffect(() => {
    if (!activeChild?.id || !activeExam) { setMarks([]); return; }
    (async () => {
      const { data } = await supabase
        .from("marks")
        .select("id, marks_obtained, max_marks, grade, subject_id, subjects(name)")
        .eq("student_id", activeChild.id)
        .eq("exam_id", activeExam);
      setMarks((data ?? []) as any);
    })();
  }, [activeChild?.id, activeExam]);

  const obt = marks.reduce((s, m) => s + Number(m.marks_obtained ?? 0), 0);
  const max = marks.reduce((s, m) => s + Number(m.max_marks ?? 0), 0);
  const overall = max > 0 ? Math.round((obt / max) * 100) : null;

  const currentExam = exams.find((e) => e.id === activeExam);

  const downloadPdf = () => {
    if (!activeChild || !currentExam) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Report Card", 14, 20);
    doc.setFontSize(11);
    doc.text(`Student: ${activeChild.name}`, 14, 32);
    doc.text(`Class: ${activeChild.classLabel}`, 14, 39);
    doc.text(`Exam: ${currentExam.name}`, 14, 46);
    doc.text(`Date: ${format(new Date(), "dd MMM yyyy")}`, 14, 53);

    let y = 68;
    doc.setFontSize(12);
    doc.text("Subject", 14, y);
    doc.text("Marks", 110, y);
    doc.text("Max", 140, y);
    doc.text("Grade", 170, y);
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    marks.forEach((m) => {
      doc.text(m.subjects?.name ?? "—", 14, y);
      doc.text(String(m.marks_obtained ?? "—"), 110, y);
      doc.text(String(m.max_marks ?? "—"), 140, y);
      doc.text(m.grade ?? "—", 170, y);
      y += 7;
    });
    y += 4; doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(12);
    doc.text(`Total: ${obt} / ${max}`, 14, y);
    doc.text(`Percentage: ${overall ?? 0}%`, 110, y);
    doc.save(`${activeChild.name}-${currentExam.name}.pdf`);
    toast.success("Report card downloaded");
  };

  if (!activeChild) return <div className="p-12 text-center text-sm text-muted-foreground">No child selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marks</h1>
        <p className="text-sm text-muted-foreground">{activeChild.name} · {activeChild.classLabel}</p>
      </div>

      {exams.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">No exams scheduled yet.</Card>
      ) : (
        <Tabs value={activeExam} onValueChange={setActiveExam}>
          <TabsList className="flex flex-wrap h-auto">
            {exams.map((e) => <TabsTrigger key={e.id} value={e.id}>{e.name}</TabsTrigger>)}
          </TabsList>

          {exams.map((e) => (
            <TabsContent key={e.id} value={e.id} className="space-y-4">
              <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Overall percentage</div>
                  <div className="text-3xl font-display font-bold mt-1">{overall == null ? "—" : `${overall}%`}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{obt} of {max} marks</div>
                </div>
                {e.published && marks.length > 0 && (
                  <Button onClick={downloadPdf}><Download className="mr-2 h-4 w-4" /> Download Report Card</Button>
                )}
              </Card>

              <Card>
                {marks.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {e.published ? "No marks entered for this exam." : "Marks not published yet."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Marks</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marks.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.subjects?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">{m.marks_obtained ?? "—"}</TableCell>
                          <TableCell className="text-right">{m.max_marks ?? "—"}</TableCell>
                          <TableCell className="text-right">{m.grade ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
