const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const prisma = require("../prisma");

const sessionConfig = {
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
  },
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000, // 2 minutes in milliseconds
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
  }),
};

module.exports = sessionConfig;
