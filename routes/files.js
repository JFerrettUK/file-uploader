const express = require("express");
const multer = require("multer");
const path = require("path");
const prisma = require("../prisma");
const router = express.Router();

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
      const file = await prisma.file.create({
        data: {
          filename: req.file.originalname,
          filepath: req.file.path,
          mimetype: req.file.mimetype,
          size: req.file.size,
          userId: req.user.id,
          folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
        },
      });

      // Redirect to the folders page after successful upload
      res.redirect("/folders"); // Or redirect to a specific folder if needed
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

    res.download(file.filepath, file.filename, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).send("Error downloading file.");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing download request.");
  }
});

module.exports = router;
