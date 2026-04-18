import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { sql } from './db'

export const authOptions: NextAuthOptions = {
  providers: [
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
        const valid = await bcrypt.compare(credentials.password, user.password_hash as string)
        if (!valid) return null
        return { id: String(user.id), email: user.email as string, name: user.name as string }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id
      return session
    },
  },
}
