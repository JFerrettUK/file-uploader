const request = require("supertest");
const app = require("../index");
const fs = require("fs");
const path = require("path");
const prisma = require("../prisma");
const bcrypt = require("bcrypt");

describe("File Routes", () => {
  let agent;
  let testUser;

  beforeAll(async () => {
    // Clean up before all tests
    await prisma.file.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.user.deleteMany({ where: { email: "testuser@example.com" } });

    // Create a test user
    testUser = await prisma.user.create({
      data: {
        email: "testuser@example.com",
        password: await bcrypt.hash("testpassword", 10), // Hash the password
      },
    });

    // Log in and get the agent
    agent = request.agent(app);
    await agent
      .post("/login")
      .send({ email: "testuser@example.com", password: "testpassword" });
  });

  afterAll(async () => {
    // Clean up after all tests
    const files = await prisma.file.findMany({
      where: { userId: testUser.id },
    });
    for (const file of files) {
      const filePath = path.join(__dirname, "../", file.filepath);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(
          `Error deleting file ${file.filepath}: ${
            err.message || "Unknown error"
          }`
        );
      }
    }
    await prisma.file.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.user.deleteMany({ where: { email: "testuser@example.com" } });
    await prisma.$disconnect();
  });

  describe("POST /upload", () => {
    it("should upload a file successfully", async () => {
      const res = await agent
        .post("/upload")
        .attach("file", "__tests__/test-files/test-upload.txt");

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("File uploaded successfully!");

      // Verify file creation in database
      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id },
      });
      expect(uploadedFile).not.toBeNull();
      expect(uploadedFile.filename).toEqual("test-upload.txt");

      // Verify that the file exists on the file system
      const filePath = path.join(__dirname, "../", uploadedFile.filepath);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("GET /files/:fileId", () => {
    it("should get file details", async () => {
      // Create a file
      const file = await prisma.file.create({
        data: {
          filename: "test-file.txt",
          filepath: "uploads/test-file.txt", // Provide a valid path
          mimetype: "text/plain",
          size: 1024,
          userId: testUser.id,
        },
      });

      const res = await agent.get(`/files/${file.id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("test-file.txt"); // Check for file name
    });
  });

  describe("GET /download/:fileId", () => {
    it("should download a file", async () => {
      // Create a file for testing
      const testFilePath = path.join(__dirname, "../uploads/test-download.txt");
      const testFileContent = "This is a test file for download.";
      fs.writeFileSync(testFilePath, testFileContent);

      const file = await prisma.file.create({
        data: {
          filename: "test-download.txt",
          filepath: "uploads/test-download.txt", // Provide a valid path
          mimetype: "text/plain",
          size: testFileContent.length,
          userId: testUser.id,
        },
      });

      const res = await agent.get(`/download/${file.id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.header["content-type"]).toContain("text/plain");
      expect(res.text).toEqual(testFileContent);

      // Clean up the created file
      fs.unlinkSync(testFilePath);
    });
  });
});
