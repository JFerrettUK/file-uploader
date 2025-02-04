const request = require("supertest");
const app = require("../index");
const prisma = require("../prisma");
const bcrypt = require("bcrypt");

describe("Authentication Routes", () => {
  beforeAll(async () => {
    // Clean up the test user before tests (if it exists)
    await prisma.user.deleteMany({
      where: { email: "testuser@example.com" },
    });
  });

  afterAll(async () => {
    // Clean up after tests
    await prisma.user.deleteMany({
      where: { email: "testuser@example.com" },
    });
    await prisma.$disconnect();
  });

  describe("POST /register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/register")
        .send({ email: "testuser@example.com", password: "testpassword" });

      expect(res.statusCode).toEqual(302); // Expect redirect after registration
      expect(res.headers.location).toEqual("/"); // Should redirect to homepage

      // Verify that the user was created in the database
      const user = await prisma.user.findUnique({
        where: { email: "testuser@example.com" },
      });
      expect(user).not.toBeNull();
      expect(await bcrypt.compare("testpassword", user.password)).toBe(true);
    });

    it("should handle duplicate email registration", async () => {
      const res = await request(app)
        .post("/register")
        .send({ email: "testuser@example.com", password: "testpassword" });

      expect(res.statusCode).toEqual(400); // Expect error due to duplicate email
      expect(res.text).toContain("Email already exists"); // Check for error message
    });
  });

  describe("POST /login", () => {
    it("should successfully log in with correct credentials", async () => {
      const res = await request(app)
        .post("/login")
        .send({ email: "testuser@example.com", password: "testpassword" });

      expect(res.statusCode).toEqual(302); // Expect redirect after login
      expect(res.headers.location).toEqual("/"); // Should redirect to homepage
    });

    it("should fail to log in with incorrect credentials", async () => {
      const res = await request(app)
        .post("/login")
        .send({ email: "testuser@example.com", password: "wrongpassword" });

      expect(res.statusCode).toEqual(401); // Expect unauthorized
      expect(res.text).toContain("Incorrect password.");
    });
  });

  describe("POST /logout", () => {
    it("should successfully log out", async () => {
      // First, log in
      const agent = request.agent(app); // Create an agent to maintain the session
      await agent
        .post("/login")
        .send({ email: "testuser@example.com", password: "testpassword" });

      // Then, log out
      const res = await agent.post("/logout");

      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toEqual("/"); // Should redirect to homepage
    });
  });
});
