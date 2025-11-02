import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma/prismaClient.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI, // ✅ points to your backend
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      accessType: 'offline',           // ✅ ensures refresh token is returned
      prompt: 'consent',               // ✅ forces asking for permission each time
      includeGrantedScopes: true,      // ✅ reuse previously granted scopes
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Calculate token expiry (Google access tokens typically last 1 hour)
        const tokenExpiry = new Date(Date.now() + 3600 * 1000);

        // 1️⃣ Check if user exists by google_id
        let user = await prisma.user.findFirst({
          where: { google_id: profile.id },
        });

        // 2️⃣ If not found, check if user exists by email
        if (!user) {
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          if (user && !user.google_id) {
            // Update existing user with Google info
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: {
                google_id: profile.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expiry: tokenExpiry,
                last_login: new Date(),
                display_name: profile.displayName,
                profile_picture: profile.photos?.[0]?.value || null,
              },
            });
          } else if (!user) {
            // 3️⃣ Create new user
            user = await prisma.user.create({
              data: {
                google_id: profile.id,
                email: profile.emails[0].value,
                display_name: profile.displayName,
                profile_picture: profile.photos?.[0]?.value || null,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expiry: tokenExpiry,
                last_login: new Date(),
              },
            });
          }
        } else {
          // 4️⃣ Update existing user with fresh tokens and profile
          user = await prisma.user.update({
            where: { google_id: profile.id },
            data: {
              access_token: accessToken,
              refresh_token: refreshToken,
              token_expiry: tokenExpiry,
              last_login: new Date(),
              display_name: profile.displayName,
              profile_picture: profile.photos?.[0]?.value || null,
            },
          });
        }

        // ✅ Pass updated user to next middleware
        return done(null, user);
      } catch (err) {
        console.error('Passport GoogleStrategy error:', err);
        return done(err, null);
      }
    }
  )
);

export default passport;