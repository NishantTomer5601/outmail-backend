import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma/prismaClient.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'https://outmail-backend-using-upstash-redis.onrender.com/api/auth/google/callback',
      passReqToCallback: false, // important
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Google usually gives a 1-hour access token
        const tokenExpiry = new Date(Date.now() + 3600 * 1000);

        // Try finding by Google ID first
        let user = await prisma.user.findFirst({
          where: { google_id: profile.id },
        });

        if (!user) {
          // Try finding by email
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          if (user && !user.google_id) {
            // Existing user - link Google account
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
            // New user - create
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
          // Update existing user with new tokens
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

        return done(null, user);
      } catch (err) {
        console.error('Google OAuth strategy error:', err);
        return done(err, null);
      }
    }
  )
);

export default passport;