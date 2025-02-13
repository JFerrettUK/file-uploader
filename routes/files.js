const express = require("express");
const multer = require("multer");
const path = require("path");
const { PrismaClient } = require("@prisma/client"); // Use { } for named import
const router = express.Router();
const cloudinary = require("cloudinary").v2; // Correct import
const fs = require("fs");

const prisma = new PrismaClient(); // Instantiate Prisma Client *here*

// --- Multer Configuration ---
// NO CHANGES HERE - the directory creation is handled in index.js

// Use the __dirname-based path for uploads (defined in index.js)
const uploadDir = path.join(__dirname, "../uploads"); // Correct relative path

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use the uploadDir variable
  },
  filename: function (req, file, cb) {
    // Use originalname, but prepend a timestamp for uniqueness
    cb(null, "file-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// --- Authentication Middleware (No Changes) ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// --- Upload Form Route (GET) (No Changes)---
router.get("/upload-form", ensureAuthenticated, (req, res) => {
  res.render("upload", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

// --- Upload Route (POST) ---
router.post(
  "/upload",
  ensureAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // 1. Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "file-uploader", // Optional: Set a folder
        resource_type: "raw", // Important for non-image/video files
      });
      console.log("Cloudinary upload result:", result);

      // 2. Get secure URL
      const fileUrl = result.secure_url;

      // 3. Save to database
      const file = await prisma.file.create({
        data: {
          filename: req.file.originalname, // Use original filename
          filepath: fileUrl, // Store Cloudinary URL
          mimetype: req.file.mimetype,
          size: req.file.size,
          userId: req.user.id,
          folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
        },
      });

      // 4. Delete temporary file
      fs.unlinkSync(req.file.path);

      res.send("File uploaded successfully!"); // Or redirect as needed
    } catch (error) {
      console.error("Upload Error:", error); //  Log the FULL error
      res.status(500).send("Error uploading file.");
    }
  }
);

// --- File Details Route ---
router.get("/files/:fileId", ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true }, // Assuming you have a folder relation
    });

    if (!file) {
      return res.status(404).send("File not found");
    }

    if (file.userId !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    res.render("file", {
      // Assuming you have a 'file.ejs' view
      file,
      isAuthenticated: req.isAuthenticated(),
      user: req.user,
    });
  } catch (error) {
    console.error("file details error", error);
    res.status(500).send("Error fetching file details.");
  }
});

// --- Download Route ---
router.get("/download/:fileId", ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== req.user.id) {
      return res.status(404).send("File not found or unauthorized");
    }

    // Redirect directly to Cloudinary
    res.redirect(file.filepath);
  } catch (error) {
    console.error("Download Error", error);
    res.status(500).send("Error processing download request.");
  }
});

// --- Delete a file ---
router.delete("/files/:fileId", ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);

    // Check if file exists and belongs to current user
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== req.user.id) {
      return res.status(404).send("File not found or unauthorized");
    }

    // Extract public ID from Cloudinary URL
    const publicId = file.filepath.match(/\/([^\/]+)\.[a-z]+$/i)[1];

    // Delete the file from Cloudinary
    if (publicId) {
      await cloudinary.uploader.destroy(`file-uploader/${publicId}`, {
        //Added folder
        resource_type: "raw",
      });
    }

    // Delete file from database
    await prisma.file.delete({
      where: { id: fileId },
    });

    res.redirect("/folders"); // Redirect, e.g., to a file listing
  } catch (error) {
    console.error("Delete Error", error);
    res.status(500).send("Error deleting file.");
  }
});

module.exports = router;
