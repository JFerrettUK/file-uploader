const express = require("express");
const session = require("express-session");
const passport = require("./lib/passport"); // Assuming you have passport configured
const sessionConfig = require("./lib/session"); //And session
const methodOverride = require("method-override");
const path = require("path");
const multer = require("multer"); // Import multer
const fs = require("fs"); // Import fs
const cloudinary = require("cloudinary").v2; // Import Cloudinary
const { PrismaClient } = require("@prisma/client");

// Load environment variables
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Create the uploads directory if it doesn't exist ---
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
// --- End of directory creation code ---

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use the uploadDir variable
  },
  filename: function (req, file, cb) {
    cb(null, "file-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// --- EJS Configuration ---
app.set("view engine", "ejs");
app.set("views", "./views");

// --- Serve Static Files ---
app.use(express.static(path.join(__dirname, "public")));

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// Mount routes - KEEP YOUR EXISTING ROUTES
const authRoutes = require("./routes/auth");
const folderRoutes = require("./routes/folders");
const fileRoutes = require("./routes/files"); //You will edit THIS
app.use("/", authRoutes);
app.use("/", folderRoutes);
app.use("/", fileRoutes);

// --- Basic Route (using index.ejs) ---
app.get("/", (req, res) => {
  res.render("index", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

// --- Server Start ---
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
