import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { sql } from './db'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const rows = await sql`SELECT * FROM users WHERE email = ${credentials.email} LIMIT 1`
        const user = rows[0]
        if (!user) return null
        if (!user.password_hash) return null // Google-only account
        const valid = await bcrypt.compare(credentials.password, user.password_hash as string)
        if (!valid) return null
        return { id: String(user.id), email: user.email as string, name: user.name as string }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // Find or create user in DB for Google sign-ins
        const existing = await sql`SELECT id FROM users WHERE email = ${user.email} LIMIT 1`
        if (existing.length === 0) {
          await sql`INSERT INTO users (email, name, password_hash) VALUES (${user.email}, ${user.name}, NULL)`
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // On first sign-in, fetch the DB id
        const rows = await sql`SELECT id FROM users WHERE email = ${token.email} LIMIT 1`
        if (rows[0]) token.id = String(rows[0].id)
      }
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id
      return session
    },
  },
}
