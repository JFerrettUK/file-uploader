// prisma/index.js (or your Prisma client initialization file)
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Use the Koyeb-provided environment variable
    },
  },
});

module.exports = prisma;
