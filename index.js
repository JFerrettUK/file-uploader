const express = require("express");
const session = require("express-session");
const passport = require("./lib/passport");
const sessionConfig = require("./lib/session");
const methodOverride = require("method-override"); // Import method-override
require("dotenv").config();

const authRoutes = require("./routes/auth");
const folderRoutes = require("./routes/folders");
const fileRoutes = require("./routes/files");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method")); // Configure method-override

app.use("/", authRoutes);
app.use("/", folderRoutes);
app.use("/", fileRoutes);

app.get("/", (req, res) => {
  res.render("index", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
