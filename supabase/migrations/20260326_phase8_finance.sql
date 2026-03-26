-- Migration: Add Finance and Deductions Module
-- 1. Student Packages Table
CREATE TABLE IF NOT EXISTS public.edu_student_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    total_classes INTEGER NOT NULL CHECK (total_classes > 0),
    used_classes INTEGER NOT NULL DEFAULT 0 CHECK (used_classes >= 0),
    price NUMERIC NOT NULL CHECK (price >= 0),
    amount_paid NUMERIC NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'paid')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'exhausted', 'refunded', 'cancelled')
    ),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- RLS for student_packages
ALTER TABLE public.edu_student_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view their students' packages" ON public.edu_student_packages FOR
SELECT USING (
        auth.uid() = teacher_id
        OR auth.uid() IN (
            SELECT auth_user_id
            FROM public.students
            WHERE id = student_id
        )
    );
CREATE POLICY "Teachers can insert/update their students' packages" ON public.edu_student_packages FOR ALL USING (auth.uid() = teacher_id);
-- 2. Financial Transactions
CREATE TABLE IF NOT EXISTS public.edu_financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.edu_student_packages(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (
        payment_method IN (
            'wechat',
            'alipay',
            'bank_transfer',
            'cash',
            'other'
        )
    ),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT
);
-- RLS
ALTER TABLE public.edu_financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view their students' transactions" ON public.edu_financial_transactions FOR
SELECT USING (
        auth.uid() IN (
            SELECT teacher_id
            FROM public.edu_student_packages
            WHERE id = package_id
        )
        OR auth.uid() IN (
            SELECT auth_user_id
            FROM public.students
            WHERE id = student_id
        )
    );
CREATE POLICY "Teachers can insert their students' transactions" ON public.edu_financial_transactions FOR ALL USING (
    auth.uid() IN (
        SELECT teacher_id
        FROM public.edu_student_packages
        WHERE id = package_id
    )
);
-- 3. Class Deductions
CREATE TABLE IF NOT EXISTS public.edu_class_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.edu_student_packages(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE
    SET NULL,
        deduction_amount INTEGER NOT NULL DEFAULT 1 CHECK (deduction_amount > 0),
        deduction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        deduction_type TEXT NOT NULL CHECK (
            deduction_type IN ('attendance_auto', 'manual_adjustment')
        ),
        notes TEXT
);
-- RLS
ALTER TABLE public.edu_class_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view their students' deductions" ON public.edu_class_deductions FOR
SELECT USING (
        auth.uid() IN (
            SELECT teacher_id
            FROM public.edu_student_packages
            WHERE id = package_id
        )
        OR auth.uid() IN (
            SELECT auth_user_id
            FROM public.students
            WHERE id = student_id
        )
    );
CREATE POLICY "Teachers can insert their students' deductions" ON public.edu_class_deductions FOR ALL USING (
    auth.uid() IN (
        SELECT teacher_id
        FROM public.edu_student_packages
        WHERE id = package_id
    )
);
-- 4. Attendance Updates for Dual Confirmation
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS student_signed_in_at TIMESTAMP WITH TIME ZONE NULL;
-- 5. RPC & Triggers for Auto Deduction
CREATE OR REPLACE FUNCTION public.edu_process_attendance_deduction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_package_id UUID;
v_deduction_id UUID;
BEGIN -- Only trigger deduction if both sides confirmed
IF (
    NEW.status IN ('present', 'late')
    AND NEW.student_signed_in_at IS NOT NULL
) THEN -- Check if a deduction array exists for this session+student to avoid double-deducting
SELECT id into v_deduction_id
FROM public.edu_class_deductions
WHERE session_id = NEW.session_id
    AND student_id = NEW.student_id
LIMIT 1;
IF v_deduction_id IS NULL THEN -- Find the oldest active package with available balance
SELECT id INTO v_package_id
FROM public.edu_student_packages
WHERE student_id = NEW.student_id
    AND status = 'active'
    AND used_classes < total_classes
ORDER BY created_at ASC
LIMIT 1;
IF v_package_id IS NOT NULL THEN -- Deduct 1 class
UPDATE public.edu_student_packages
SET used_classes = used_classes + 1
WHERE id = v_package_id;
-- If the package is now exhausted, mark it
UPDATE public.edu_student_packages
SET status = 'exhausted'
WHERE id = v_package_id
    AND used_classes >= total_classes;
-- Insert Deduction Log
INSERT INTO public.edu_class_deductions (
        student_id,
        package_id,
        session_id,
        deduction_amount,
        deduction_type
    )
VALUES (
        NEW.student_id,
        v_package_id,
        NEW.session_id,
        1,
        'attendance_auto'
    );
END IF;
END IF;
END IF;
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_edu_attendance_deduction ON public.attendance;
CREATE TRIGGER trigger_edu_attendance_deduction
AFTER
INSERT
    OR
UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.edu_process_attendance_deduction();
-- Realtime publication
ALTER PUBLICATION supabase_realtime
ADD TABLE public.edu_student_packages;
ALTER PUBLICATION supabase_realtime
ADD TABLE public.edu_financial_transactions;
ALTER PUBLICATION supabase_realtime
ADD TABLE public.edu_class_deductions;