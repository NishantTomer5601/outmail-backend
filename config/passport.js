import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma/prismaClient.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.send',
      ],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Calculate token expiry (Google tokens typically last 1 hour)
        const tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

        let user = await prisma.user.findFirst({
          where: { google_id: profile.id },
        });

        if (!user) {
          // Try to find by email
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          if (user && !user.google_id) {
            // Update existing user with Google ID and tokens
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: {
                google_id: profile.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expiry: tokenExpiry,
                last_login: new Date(),
              },
            });
          } else if (!user) {
            // Create new user
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
          // Update existing user with fresh tokens
          user = await prisma.user.update({
            where: { google_id: profile.id },
            data: {
              access_token: accessToken,
              refresh_token: refreshToken,
              token_expiry: tokenExpiry,
              last_login: new Date(),
              // Update profile info in case it changed
              display_name: profile.displayName,
              profile_picture: profile.photos?.[0]?.value || null,
            },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;