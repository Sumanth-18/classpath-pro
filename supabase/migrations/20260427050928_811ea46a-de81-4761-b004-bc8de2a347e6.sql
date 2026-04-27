
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('school_admin', 'teacher', 'parent', 'student');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE public.gender AS ENUM ('male', 'female', 'other');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'upi', 'cheque', 'online', 'card');
CREATE TYPE public.fee_status AS ENUM ('paid', 'due', 'overdue', 'partial');
CREATE TYPE public.assignment_type AS ENUM ('homework', 'classwork', 'reading', 'project');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.announcement_type AS ENUM ('general', 'event', 'holiday', 'urgent');
CREATE TYPE public.audience_type AS ENUM ('everyone', 'parents', 'teachers', 'students');
CREATE TYPE public.event_type AS ENUM ('holiday', 'event', 'exam', 'meeting');

-- =========================================
-- SCHOOLS
-- =========================================
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  email TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'trial',
  academic_year TEXT DEFAULT '2026-2027',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- PROFILES (one per auth user)
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- USER ROLES (separate, with school scope)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id, role)
);

-- =========================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_in_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND school_id = _school_id
  );
$$;

-- =========================================
-- TIMESTAMP TRIGGER
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- ACADEMIC STRUCTURE
-- =========================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  numeric_level INT,
  curriculum TEXT DEFAULT 'CBSE',
  academic_year TEXT DEFAULT '2026-2027',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_teacher_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  max_marks INT DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  admission_number TEXT NOT NULL,
  name TEXT NOT NULL,
  date_of_birth DATE,
  gender public.gender,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

CREATE TABLE public.parent_student (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relation TEXT DEFAULT 'parent',
  UNIQUE (parent_user_id, student_id)
);

CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id),
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID REFERENCES public.profiles(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exam_type TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(6,2),
  max_marks NUMERIC(6,2) DEFAULT 100,
  grade TEXT,
  entered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, exam_id, subject_id)
);

CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly',
  due_day INT DEFAULT 5,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES public.fee_structures(id),
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_mode public.payment_mode DEFAULT 'cash',
  receipt_number TEXT,
  for_month TEXT,
  status public.fee_status DEFAULT 'paid',
  collected_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.fee_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES public.fee_structures(id),
  amount_due NUMERIC(10,2) NOT NULL,
  due_date DATE,
  for_month TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  max_marks NUMERIC(6,2) DEFAULT 100,
  assignment_type public.assignment_type DEFAULT 'homework',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.online_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  meeting_link TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 45,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  employee_id TEXT,
  department TEXT,
  designation TEXT,
  date_of_joining DATE,
  salary NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority public.task_priority DEFAULT 'medium',
  status public.task_status DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT,
  from_date DATE,
  to_date DATE,
  reason TEXT,
  status public.leave_status DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  content TEXT,
  audience public.audience_type DEFAULT 'everyone',
  type public.announcement_type DEFAULT 'general',
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'general',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.school_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type public.event_type DEFAULT 'event',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id),
  day_of_week INT NOT NULL,
  period_number INT NOT NULL,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES
-- =========================================

-- schools: users see their own school; anyone authenticated can insert (for registration); admins can update
CREATE POLICY "View own school" ON public.schools FOR SELECT TO authenticated
  USING (id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Anyone authenticated can create school" ON public.schools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update own school" ON public.schools FOR UPDATE TO authenticated
  USING (id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- profiles
CREATE POLICY "View profiles in own school" ON public.profiles FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins update profiles in school" ON public.profiles FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- user_roles: users can view their own roles; admins can manage roles in their school
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin')));
CREATE POLICY "Self-insert role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- Generic helper policy template per school-scoped table
-- classes
CREATE POLICY "View classes in school" ON public.classes FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- sections
CREATE POLICY "View sections in school" ON public.sections FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage sections" ON public.sections FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- subjects
CREATE POLICY "View subjects in school" ON public.subjects FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- students
CREATE POLICY "View students in school (admin/teacher)" ON public.students FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));
CREATE POLICY "Parents view own children" ON public.students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student ps WHERE ps.student_id = students.id AND ps.parent_user_id = auth.uid()));
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- parent_student
CREATE POLICY "View parent_student links" ON public.parent_student FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_student.student_id AND s.school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin')));
CREATE POLICY "Admins manage parent_student" ON public.parent_student FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_student.student_id AND s.school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = parent_student.student_id AND s.school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin')));

-- teacher_assignments
CREATE POLICY "View teacher assignments in school" ON public.teacher_assignments FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage teacher assignments" ON public.teacher_assignments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- attendance
CREATE POLICY "View attendance in school (staff)" ON public.attendance FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));
CREATE POLICY "Parents view child attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student ps WHERE ps.student_id = attendance.student_id AND ps.parent_user_id = auth.uid()));
CREATE POLICY "Staff manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- exams
CREATE POLICY "View exams in school" ON public.exams FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- marks
CREATE POLICY "View marks in school (staff)" ON public.marks FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));
CREATE POLICY "Parents view child marks" ON public.marks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student ps WHERE ps.student_id = marks.student_id AND ps.parent_user_id = auth.uid()));
CREATE POLICY "Staff manage marks" ON public.marks FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- fee_structures
CREATE POLICY "View fee structures in school" ON public.fee_structures FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage fee structures" ON public.fee_structures FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- fee_payments
CREATE POLICY "View fee payments (admin)" ON public.fee_payments FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));
CREATE POLICY "Parents view child payments" ON public.fee_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student ps WHERE ps.student_id = fee_payments.student_id AND ps.parent_user_id = auth.uid()));
CREATE POLICY "Admins manage fee payments" ON public.fee_payments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- fee_dues
CREATE POLICY "View fee dues (admin)" ON public.fee_dues FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));
CREATE POLICY "Parents view child dues" ON public.fee_dues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student ps WHERE ps.student_id = fee_dues.student_id AND ps.parent_user_id = auth.uid()));
CREATE POLICY "Admins manage fee dues" ON public.fee_dues FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- assignments
CREATE POLICY "View assignments in school" ON public.assignments FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Staff manage assignments" ON public.assignments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- online_classes
CREATE POLICY "View online classes in school" ON public.online_classes FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Staff manage online classes" ON public.online_classes FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- staff_profiles
CREATE POLICY "View staff profiles in school" ON public.staff_profiles FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage staff profiles" ON public.staff_profiles FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- staff_tasks
CREATE POLICY "View staff tasks (assigned or admin)" ON public.staff_tasks FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR assigned_to IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Admins manage staff tasks" ON public.staff_tasks FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- leave_requests
CREATE POLICY "View own leave or admin" ON public.leave_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin')));
CREATE POLICY "Insert own leave" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins update leave" ON public.leave_requests FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- announcements
CREATE POLICY "View announcements in school" ON public.announcements FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Staff manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- notifications
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher')));

-- school_events
CREATE POLICY "View events in school" ON public.school_events FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage events" ON public.school_events FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- timetable
CREATE POLICY "View timetable in school" ON public.timetable FOR SELECT TO authenticated USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Admins manage timetable" ON public.timetable FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'));

-- =========================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_school_id := NULLIF(NEW.raw_user_meta_data->>'school_id', '')::UUID;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'school_admin');
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (user_id, school_id, name, email)
  VALUES (NEW.id, v_school_id, v_name, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, school_id, role)
    VALUES (NEW.id, v_school_id, v_role::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- INDEXES for performance
-- =========================================
CREATE INDEX idx_profiles_school ON public.profiles(school_id);
CREATE INDEX idx_students_school_section ON public.students(school_id, section_id);
CREATE INDEX idx_attendance_school_date ON public.attendance(school_id, date);
CREATE INDEX idx_marks_student ON public.marks(student_id);
CREATE INDEX idx_fee_dues_school ON public.fee_dues(school_id);
CREATE INDEX idx_announcements_school ON public.announcements(school_id, created_at DESC);
