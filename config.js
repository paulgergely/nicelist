import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://cqkosaadwkqghieplsio.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxa29zYWFkd2txZ2hpZXBsc2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NjE4ODgsImV4cCI6MjA1MjQzNzg4OH0.i_6K2Ehzmj9NKmKv-zOFkcwH7bF5tG-Tw4naOiPfOfo'
const supabase = createClient(supabaseUrl, supabaseKey)

export { supabase } 