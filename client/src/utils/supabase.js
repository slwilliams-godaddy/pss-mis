import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kyhicfgzummqzfafbmxm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5aGljZmd6dW1tcXpmYWZibXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjQxODAsImV4cCI6MjA5NDM0MDE4MH0.xyIfKKbCJ8icCYfpMMiVFV7qoIFRdvHshTKCIdeYe-w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
