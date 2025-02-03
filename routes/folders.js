const express = require("express");
const prisma = require("../prisma");
const router = express.Router();

// --- Authentication Middleware ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// --- Create a folder ---
router.post("/create-folder", ensureAuthenticated, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    const newFolder = await prisma.folder.create({
      data: {
        name,
        userId: req.user.id,
        parentId: parentId ? parseInt(parentId) : null,
      },
    });

    if (parentId) {
      res.redirect(`/folders/${parentId}`);
    } else {
      res.redirect("/folders");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating folder.");
  }
});

// --- Get folders (for a user) - Lists root folders only ---
router.get("/folders", ensureAuthenticated, async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        userId: req.user.id,
        parentId: null, // Get only root folders
      },
    });

    res.render("folders", { folders });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching folders.");
  }
});

// --- Get a specific folder (and its contents) ---
router.get("/folders/:folderId", ensureAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const folder = await prisma.folder.findUnique({
      where: {
        id: folderId,
      },
      include: {
        files: true, // Include files in the folder
        children: true, // Include subfolders
      },
    });

    if (!folder) {
      return res.status(404).send("Folder not found");
    }

    if (folder.userId !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    res.render("folder", { folder });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching folder.");
  }
});

// --- Update a folder (rename) ---
router.put("/folders/:folderId", ensureAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);
    const { name } = req.body;

    const updatedFolder = await prisma.folder.update({
      where: {
        id: folderId,
      },
      data: {
        name,
      },
    });

    if (!updatedFolder) {
      return res.status(404).send("Folder not found");
    }

    if (updatedFolder.userId !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    res.redirect(`/folders/${folderId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating folder.");
  }
});

// --- Delete a folder ---
router.delete("/folders/:folderId", ensureAuthenticated, async (req, res) => {
  try {
    const folderId = parseInt(req.params.folderId);

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return res.status(404).send("Folder not found");
    }
    if (folder.userId !== req.user.id) {
      return res.status(403).send("Unauthorized");
    }

    await prisma.folder.delete({
      where: { id: folderId },
    });

    res.redirect("/folders");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error deleting folder.");
  }
});

module.exports = router;
