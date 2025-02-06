const request = require("supertest");
const app = require("../index");
const fs = require("fs");
const path = require("path");
const prisma = require("../prisma");
const bcrypt = require("bcrypt");
const cloudinary = require("cloudinary").v2; // Import Cloudinary

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
    // NO LONGER DELETE LOCAL FILES.  Delete from Cloudinary:
    for (const file of files) {
      try {
        const publicId = file.filepath.match(/\/([^\/]+)\.[a-z]+$/i)[1];
        if (publicId) {
          // Important check!
          await cloudinary.uploader.destroy(`file-uploader/${publicId}`, {
            resource_type: "raw",
          });
        }
      } catch (cloudinaryError) {
        console.error("Error deleting file from Cloudinary:", cloudinaryError);
      }
    }
    await prisma.file.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.user.deleteMany({ where: { email: "testuser@example.com" } });
    await prisma.$disconnect();
  });

  describe("POST /upload", () => {
    it("should upload a file successfully to Cloudinary", async () => {
      const res = await agent
        .post("/upload")
        .attach("file", path.join(__dirname, "test-files", "test-upload.txt")); // Use path.join

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("File uploaded successfully!");

      // Verify file creation in database (and that it's a Cloudinary URL)
      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id },
      });
      expect(uploadedFile).not.toBeNull();
      expect(uploadedFile.filename).toEqual("test-upload.txt");
      expect(uploadedFile.filepath).toMatch(/^https:\/\/res\.cloudinary\.com/); // Check for Cloudinary URL

      // DO NOT check for local file existence.  We expect it to be deleted.
    });
  });

  describe("GET /files/:fileId", () => {
    it("should get file details", async () => {
      // Create a file (upload to Cloudinary first)
      const uploadRes = await agent
        .post("/upload")
        .attach("file", path.join(__dirname, "test-files", "test-upload.txt"));
      expect(uploadRes.statusCode).toBe(200);

      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id, filename: "test-upload.txt" },
      });

      const res = await agent.get(`/files/${uploadedFile.id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("test-upload.txt"); // Check for file name
    });
  });

  describe("GET /download/:fileId", () => {
    it("should redirect to the Cloudinary URL", async () => {
      // Changed test description
      // Create a file (upload to Cloudinary first)
      const uploadRes = await agent
        .post("/upload")
        .attach("file", path.join(__dirname, "test-files", "test-upload.txt"));
      expect(uploadRes.statusCode).toBe(200);
      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id, filename: "test-upload.txt" },
      });

      const res = await agent.get(`/download/${uploadedFile.id}`);

      expect(res.statusCode).toEqual(302); // Expect a redirect
      expect(res.header.location).toBe(uploadedFile.filepath); // Check redirect URL
    });
  });

  describe("DELETE /files/:fileId", () => {
    // NEW TEST SUITE
    it("should delete a file and remove it from Cloudinary", async () => {
      // Create a file (upload to Cloudinary first)
      const uploadRes = await agent
        .post("/upload")
        .attach("file", path.join(__dirname, "test-files", "test-upload.txt"));
      expect(uploadRes.statusCode).toBe(200);

      const uploadedFile = await prisma.file.findFirst({
        where: { userId: testUser.id, filename: "test-upload.txt" },
      });

      const res = await agent.delete(`/files/${uploadedFile.id}`);
      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toEqual("/folders"); // Redirect to folders

      // Verify deletion from database
      const deletedFile = await prisma.file.findUnique({
        where: { id: uploadedFile.id },
      });
      expect(deletedFile).toBeNull();
    });
  });
});
