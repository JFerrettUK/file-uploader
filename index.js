const express = require("express");
const session = require("express-session");
const passport = require("./lib/passport");
const sessionConfig = require("./lib/session");
const methodOverride = require("method-override");

// Load environment variables
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const folderRoutes = require("./routes/folders");
const fileRoutes = require("./routes/files");

const app = express();
const port = process.env.PORT || 3000;

// --- EJS Configuration ---
app.set("view engine", "ejs");
app.set("views", "./views");

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// Mount routes
app.use("/", authRoutes); // Mount authentication routes
app.use("/", folderRoutes); // Mount folder routes
app.use("/", fileRoutes); // Mount file routes

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
