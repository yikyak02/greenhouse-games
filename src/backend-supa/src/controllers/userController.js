import database from "../services/supabaseService.js";
import { sendSignupNotification } from "../services/notificationService.js";
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper Functions
//creates a user record in the userprofiles table
const createUserProfile = async (user_id, display_name, avatar_url = null, google_id = null) => {
  const profileData = { user_id, display_name };
  if (avatar_url) profileData.avatar_url = avatar_url;
  if (google_id) profileData.google_id = google_id;

  const { data, error } = await database
    .from("userprofiles")
    .insert([profileData])
    .select();

  if (error) {
    console.error("Profile insert error:", error);
    throw new Error(error.message);
  }

  return data[0];
};

const getUserProfile = async (user_id) => {
  const { data, error } = await database
    .from("userprofiles")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (error) {
    console.error("Profile fetch error:", error);
    throw new Error(error.message);
  }

  return data;
};

const verifyGoogleToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { email, name, picture, sub: googleId } = payload;

  if (!email) {
    throw new Error("Email not found in Google token.");
  }

  return { email, name, picture, googleId };
};

const findUserByEmail = async (email) => {
  const { data: users, error } = await database.auth.admin.listUsers();
  
  if (error) {
    console.error("User check error:", error);
    throw new Error(error.message);
  }

  return users.users.find(user => user.email === email);
};

const sendWelcomeEmail = async (email, display_name) => {
  try {
    await sendSignupNotification(email, display_name);
  } catch (error) {
    console.error("Email send error:", error);
    // Don't fail signup just because email failed
  }
};

// POST /api/users/signup HTTP request
export const signup = async (req, res) => {
  const { email, password, display_name } = req.body;
  if (!email || !password || !display_name) {
    return res.status(400).json({ error: "Email, password, and display name are required." });
  }

  // 1. Create Supabase user in auth.users
  const { data: authData, error: authError } = await database.auth.admin.createUser({
    email,
    password,
  });

  if (authError) {
    console.error("Auth error:", authError);
    return res.status(500).json({ error: authError.message });
  }

  const user = authData?.user;
  if (!user) {
    return res.status(500).json({ error: "User creation failed: user object is missing." });
  }

  const user_id = user.id;

  // 2. Create user profile in userprofiles table
  const profileData = await createUserProfile(user_id, display_name);

  // 3. Send welcome email
  await sendWelcomeEmail(email, display_name);

  // 4. Create session by signing in the user immediately
  const { data: sessionData, error: sessionError } = await database.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError) {
    console.error("Session creation error:", sessionError);
    // Continue without session - user can sign in later
  }

  return res.status(201).json({ 
    user, 
    profile: profileData[0],
    session: sessionData?.session,
    message: "User created successfully"
  });
};

// POST /api/users/signin HTTP request
export const signin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // 1. Sign in with Supabase auth and creates a session
    const { data: authData, error: authError } = await database.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    //retrieves session from superbase authdata
    const { user, session } = authData;

    // 2. Get user profile
    const profileData = await getUserProfile(user.id);

    return res.status(200).json({ 
      user, 
      profile: profileData,
      session,
      message: "Successfully signed in"
    });

  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({ error: "Failed to sign in." });
  }
};

// POST /api/users/google-signup HTTP request
export const googleSignup = async (req, res) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    return res.status(400).json({ error: "Google ID token is required." });
  }

  try {
    // 1. Verify Google ID token
    const { email, name, picture, googleId } = await verifyGoogleToken(idToken);

    // 2. Check if user already exists
    const userExists = await findUserByEmail(email);
    
    if (userExists) {
      return res.status(409).json({ error: "User with this email already exists." });
    }

    // 3. Create Supabase user in auth.users with Google data
    const { data: authData, error: authError } = await database.auth.admin.createUser({
      email,
      email_confirm: true, // Google users are already verified
      user_metadata: {
        google_id: googleId,
        avatar_url: picture,
        provider: 'google'
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(500).json({ error: authError.message });
    }

    const user = authData?.user;
    if (!user) {
      return res.status(500).json({ error: "User creation failed: user object is missing." });
    }

    const user_id = user.id;

    // 4. Create user profile
    const profileData = await createUserProfile(user_id, name, picture, googleId);

    // 5. Send welcome email
    await sendWelcomeEmail(email, name);

    // 6. Generate session by signing in the user immediately
    const { data: sessionData, error: sessionError } = await database.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error("Session generation error:", sessionError);
      // Continue without session - user can sign in later
    }

    //response back to client
    return res.status(201).json({ 
      user, 
      profile: profileData,
      session: sessionData,
      message: "User created successfully with Google authentication"
    });

  } catch (error) {
    console.error("Google signup error:", error);
    return res.status(500).json({ error: "Failed to verify Google token or create user." });
  }
};

// POST /api/users/google-signin HTTP request
export const googleSignin = async (req, res) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    return res.status(400).json({ error: "Google ID token is required." });
  }

  try {
    // 1. Verify Google ID token
    const { email, sub: googleId } = await verifyGoogleToken(idToken);

    // 2. Find existing user by email
    const existingUser = await findUserByEmail(email);
    
    if (!existingUser) {
      return res.status(404).json({ 
        error: "User not found. Please sign up first.",
        code: "USER_NOT_FOUND"
      });
    }

    // 3. Verify this user was created with Google (optional security check)
    const userMetadata = existingUser.user_metadata || {};
    if (userMetadata.provider !== 'google') {
      return res.status(400).json({ 
        error: "This account was not created with Google. Please use your password to sign in.",
        code: "WRONG_PROVIDER"
      });
    }

    // 4. Get user profile from userprofiles table
    const profileData = await getUserProfile(existingUser.id);

    // 5. Generate session for the user
    const { data: sessionData, error: sessionError } = await database.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error("Session generation error:", sessionError);
      // Continue without session - user can still access their data
    }

    return res.status(200).json({ 
      user: existingUser,
      profile: profileData,
      session: sessionData,
      message: "Successfully signed in with Google"
    });

  } catch (error) {
    console.error("Google signin error:", error);
    return res.status(500).json({ error: "Failed to verify Google token or authenticate user." });
  }
};
