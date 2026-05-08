import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://otbcvpgtxxidgtbxgzpo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN2cGd0eHhpZGd0YnhnenBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTE5MDUsImV4cCI6MjA5Mzc2NzkwNX0.g4fE1nkcI8vQac0iahsiBsts46lxFD4IhAE4lrwYNBE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);