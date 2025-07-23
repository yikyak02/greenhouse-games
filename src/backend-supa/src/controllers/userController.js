import database from "../services/supabaseService.js";
import { sendSignupNotification } from "../services/notificationService.js";

// POST /api/users/signup
export const signup = async (req, res) => {
  const { email, password, display_name } = req.body;
  if (!email || !password || !display_name) {
    return res.status(400).json({ error: "Email, password, and display name are required." });
  }

  // 1. Register user with Supabase Auth
  const { data: authData, error: authError } = await database.auth.admin.createUser({
    email,
    password,
  });
  if (authError) {
    return res.status(500).json({ error: authError.message });
  }
  const user_id = authData.user.id;

  // 2. Create user profile 
  const { data: profileData, error: profileError } = await database
    .from("userprofiles")
    .insert([{ user_id, display_name }])
    .select();
  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  // 3. Send welcome email
  await sendSignupNotification(email, display_name);

  return res.status(201).json({ user: authData.user, profile: profileData[0] });
}; 