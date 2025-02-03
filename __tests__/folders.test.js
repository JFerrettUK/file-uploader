const request = require("supertest");
const app = require("../index");
const prisma = require("../prisma");
const bcrypt = require("bcrypt");

describe("Folder Routes", () => {
  let agent;
  let testUser;

  beforeAll(async () => {
    // Clean up before all tests
    await prisma.folder.deleteMany({}); // Delete all folders
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
    await prisma.folder.deleteMany({}); // Delete all folders
    await prisma.user.deleteMany({ where: { email: "testuser@example.com" } });
    await prisma.$disconnect();
  });

  describe("POST /create-folder", () => {
    it("should create a new folder", async () => {
      const res = await agent
        .post("/create-folder")
        .send({ name: "Test Folder" });

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toEqual("/folders"); // Redirect to folders

      // Verify folder creation in database
      const folder = await prisma.folder.findFirst({
        where: { name: "Test Folder" },
      });
      expect(folder).not.toBeNull();
      expect(folder.userId).toEqual(testUser.id);
    });
  });

  describe("GET /folders", () => {
    it("should get a list of root folders for the user", async () => {
      const res = await agent.get("/folders");

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("Test Folder"); // Check for folder name
    });
  });

  describe("GET /folders/:folderId", () => {
    it("should get a specific folder's details", async () => {
      // Create a folder
      const folder = await prisma.folder.create({
        data: {
          name: "Specific Test Folder",
          userId: testUser.id,
        },
      });

      const res = await agent.get(`/folders/${folder.id}`);

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain("Specific Test Folder"); // Check folder name
    });
  });

  describe("PUT /folders/:folderId", () => {
    it("should update (rename) a folder", async () => {
      // Create a folder
      const folder = await prisma.folder.create({
        data: {
          name: "Folder to Rename",
          userId: testUser.id,
        },
      });

      const res = await agent
        .put(`/folders/${folder.id}`)
        .send({ name: "Renamed Folder" });

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toEqual(`/folders/${folder.id}`); // Redirect to folder

      // Verify update in database
      const updatedFolder = await prisma.folder.findUnique({
        where: { id: folder.id },
      });
      expect(updatedFolder.name).toEqual("Renamed Folder");
    });
  });

  describe("DELETE /folders/:folderId", () => {
    it("should delete a folder", async () => {
      // Create a folder
      const folder = await prisma.folder.create({
        data: {
          name: "Folder to Delete",
          userId: testUser.id,
        },
      });

      const res = await agent.delete(`/folders/${folder.id}`);

      expect(res.statusCode).toEqual(302); // Expect redirect
      expect(res.headers.location).toEqual("/folders"); // Redirect to folders

      // Verify deletion from database
      const deletedFolder = await prisma.folder.findUnique({
        where: { id: folder.id },
      });
      expect(deletedFolder).toBeNull();
    });
  });
});
