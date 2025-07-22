import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma/prismaClient.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Try to find user by google_id if present 
        let user = null;
        if (profile.id) {
          user = await prisma.user.findFirst({
            where: { google_id: profile.id },
          });
        }

        // If not found, try to find by email
        if (!user) {
          user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value },
          });

          // If found by email and google_id is not set, update google_id
          if (user && !user.google_id && profile.id) {
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: {
                google_id: profile.id,
                last_login: new Date(),
              },
            });
          } else if (user) {
            // Just update last_login
            user = await prisma.user.update({
              where: { email: profile.emails[0].value },
              data: {
                last_login: new Date(),
              },
            });
          }
        }

        // If still not found, create new user
        if (!user) {
          user = await prisma.user.create({
            data: {
              google_id: profile.id || null,
              email: profile.emails[0].value,
              display_name: profile.displayName,
              app_password_hash: '',
              last_login: new Date(),
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