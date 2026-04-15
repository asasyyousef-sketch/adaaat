import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yggszjnouybidexlhxvk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZ3N6am5vdXliaWRleGxoeHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTU1MTUsImV4cCI6MjA5MTczMTUxNX0.PeMqssORQa-d_rL_40PBfAVeero0YQE39KkI-598Mow';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
