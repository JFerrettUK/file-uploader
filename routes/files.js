const express = require("express");
const multer = require("multer");
const path = require("path");
const prisma = require("../prisma");
const router = express.Router();
const cloudinary = require("../lib/cloudinary"); // Import Cloudinary config
const fs = require("fs");

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// --- Authentication Middleware ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// --- Upload Form Route (GET) ---
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
      // 1. Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "file-uploader", // Optional: Set a folder
        resource_type: "raw", // Important for non-image/video
      });
      console.log("Cloudinary upload result:", result);

      // 2. Get secure URL
      const fileUrl = result.secure_url;

      // 3. Save to database
      const file = await prisma.file.create({
        data: {
          filename: req.file.originalname,
          filepath: fileUrl, // Store Cloudinary URL
          mimetype: req.file.mimetype,
          size: req.file.size,
          userId: req.user.id,
          folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
        },
      });

      // 4. Delete temporary file
      fs.unlinkSync(req.file.path);

      res.send("File uploaded successfully!");
    } catch (error) {
      console.error(error);
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
      include: { folder: true },
    });

    if (!file) {
      return res.status(404).send("File not found");
    }

    if (file.userId !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    res.render("file", {
      file,
      isAuthenticated: req.isAuthenticated(),
      user: req.user,
    });
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
        resource_type: "raw",
      });
    }

    // Delete file from database
    await prisma.file.delete({
      where: { id: fileId },
    });

    res.redirect("/folders"); // Redirect
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting file.");
  }
});

module.exports = router;
