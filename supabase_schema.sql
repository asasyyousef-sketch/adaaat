-- استعلام تهيئة جداول المحادثة والافتارات في Supabase
-- قم بنسخ هذا الملف وتشغيله في SQL Editor في لوحة تحكم Supabase الخاصة بمشروعك.

-- 1. جدول الرسائل (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    username TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarBgColor" TEXT,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تنشيط سياسة الحماية والوصول (Row Level Security) لجدول الرسائل
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- سياسة السماح لجميع الزوار بقراءة الرسائل
CREATE POLICY "Allow public read access to chat_messages" 
ON public.chat_messages FOR SELECT 
USING (true);

-- سياسة السماح لجميع الزوار بإضافة رسائل جديدة
CREATE POLICY "Allow public insert access to chat_messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (true);

-- سياسة السماح لجميع الزوار بتحديث الرسائل (لتحديث التفاعلات)
CREATE POLICY "Allow public update access to chat_messages" 
ON public.chat_messages FOR UPDATE 
USING (true)
WITH CHECK (true);

-- سياسة السماح بحذف الرسائل (للأدمن أو للجميع لتسهيل المسح)
CREATE POLICY "Allow public delete access to chat_messages" 
ON public.chat_messages FOR DELETE 
USING (true);


-- 2. جدول قوالب الافتارات (chat_avatars)
CREATE TABLE IF NOT EXISTS public.chat_avatars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تنشيط سياسة الحماية والوصول لجدول الافتارات
ALTER TABLE public.chat_avatars ENABLE ROW LEVEL SECURITY;

-- سياسة السماح للجميع بمشاهدة الافتارات المتاحة
CREATE POLICY "Allow public read access to chat_avatars" 
ON public.chat_avatars FOR SELECT 
USING (true);

-- سياسة السماح بإضافة قوالب افتارات جديدة
CREATE POLICY "Allow public insert access to chat_avatars" 
ON public.chat_avatars FOR INSERT 
WITH CHECK (true);

-- سياسة السماح بحذف قوالب الافتارات
CREATE POLICY "Allow public delete access to chat_avatars" 
ON public.chat_avatars FOR DELETE 
USING (true);


-- ====================================================
-- في حال كان الجدول موجوداً لديك مسبقاً وتريد فقط إضافة ميزة التفاعل (Reactions):
-- يمكنك تشغيل هذا الأمر لإضافة العمود تلقائياً:
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
-- ====================================================
