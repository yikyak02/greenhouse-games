# Google Auth Setup Guide

## Environment Variables Required

Add these to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
```

## How to Get Google Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" in the left sidebar
5. Click "Create Credentials" → "OAuth 2.0 Client IDs"
6. Choose "Web application" as the application type
7. Add your domain to "Authorized JavaScript origins"
8. Copy the Client ID and add it to your `.env` file

## API Endpoint

**POST** `/api/users/google-signup`

**Request Body:**
```json
{
  "idToken": "google_id_token_from_frontend"
}
```

**Response:**
```json
{
  "user": { /* Supabase user object */ },
  "profile": { /* User profile object */ },
  "message": "User created successfully with Google authentication"
}
```

## Frontend Integration

On your frontend, you'll need to:

1. Use Google's OAuth 2.0 flow to get an ID token
2. Send the ID token to this endpoint
3. Handle the response to complete the signup process

## Database Schema Requirements

Make sure your `userprofiles` table has these columns:
- `user_id` (UUID, references auth.users.id)
- `display_name` (TEXT)
- `avatar_url` (TEXT, optional)
- `google_id` (TEXT, optional)

## Security Notes

- The Google ID token is verified server-side for security
- Users created via Google Auth are automatically email-verified
- Duplicate email addresses are prevented 