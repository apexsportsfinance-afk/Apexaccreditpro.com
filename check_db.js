import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dixelomafeobabahqeqg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsers() {
  console.log("Checking profiles table...");
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log(`Found ${data.length} profiles:`);
    data.forEach(u => {
      console.log(`- ${u.email} (Role: ${u.role}, ID: ${u.id})`);
    });
  }

  console.log("\nChecking for potential 'roles' table...");
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
  if (rolesError) {
    console.log("Roles table not found or error:", rolesError.message);
  } else {
    console.log(`Found ${roles.length} roles:`, roles);
  }

  console.log("\nChecking for potential 'user_roles' table...");
  const { data: userRoles, error: userRolesError } = await supabase.from('user_roles').select('*');
  if (userRolesError) {
    console.log("User roles table not found or error:", userRolesError.message);
  } else {
    console.log(`Found ${userRoles.length} user roles:`, userRoles);
  }
}

checkUsers();
