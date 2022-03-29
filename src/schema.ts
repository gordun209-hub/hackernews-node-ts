import { makeExecutableSchema } from '@graphql-tools/schema'
import typeDefs from './schema.graphql'
import { APP_SECRET } from './auth'
import { hash, compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import 'graphql-import-node'
import { GraphQLContext } from './context'
import { Link, User } from '@prisma/client'
const resolvers = {
  Link: {
    id: (parent: Link) => parent.id,
    description: (parent: Link) => parent.description,
    url: (parent: Link) => parent.url,
    postedBy: async (parent: Link, args: {}, context: GraphQLContext) => {
      if (!parent.postedById) {
        return null
      }
      return context.prisma.link
        .findUnique({ where: { id: parent.id } })
        .postedBy()
    },
  },
  User: {
    links: (parent: User, args: {}, context: GraphQLContext) =>
      context.prisma.user.findUnique({ where: { id: parent.id } }).links(),
  },
  Query: {
    info: () => 'Test',
    feed: async (parent: unknown, args: {}, context: GraphQLContext) => {
      return context.prisma.link.findMany()
    },
    me: (parent: unknown, args: {}, context: GraphQLContext) => {
      if (context.currentUser === null) {
        throw new Error('unauthenticated')
      }
      return context.currentUser
    },
  },

  Mutation: {
    post: async (
      parent: unknown,
      args: { url: string; description: string },
      context: GraphQLContext
    ) => {
      if (context.currentUser === null) {
        throw new Error('Unauthenticated!')
      }
      const newLink = context.prisma.link.create({
        data: {
          url: args.url,
          description: args.description,
          postedBy: { connect: { id: context.currentUser.id } },
        },
      })
      return newLink
    },
    signup: async (
      parent: unknown,
      args: { email: string; password: string; name: string },
      context: GraphQLContext
    ) => {
      //! get user password from request
      const password = await hash(args.password, 10)
      //! create new user with given passowrd and args
      const user = await context.prisma.user.create({
        data: {
          ...args,
          password,
        },
      })
      //! generate token for user
      const token = sign({ userId: user.id }, APP_SECRET)
      //! return token and user to client for auth
      return {
        token,
        user,
      }
    },
    login: async (
      parent: unknown,
      args: { email: string; password: string },
      context: GraphQLContext
    ) => {
      const user = await context.prisma.user.findUnique({
        where: { email: args.email },
      })
      if (!user) {
        throw new Error('no such user found')
      }
      const valid = await compare(args.password, user.password)
      if (!valid) {
        throw new Error('invalid passowrd')
      }
      const token = sign({ userId: user.id }, APP_SECRET)
      return {
        token,
        user,
      }
    },
  },
}

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})
