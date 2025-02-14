const express = require("express");
const passport = require("passport");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client"); // Correct import
const router = express.Router();

const prisma = new PrismaClient(); // Instantiate Prisma Client *here*

// --- Registration Route ---
router.get("/register", (req, res) => {
  res.render("register", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render("register", {
        error: "Email and password are required.",
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    req.login(newUser, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).render("register", {
          error: "An error occurred during registration.",
          isAuthenticated: req.isAuthenticated(),
          user: req.user,
        });
      }
      return res.redirect("/");
    });
  } catch (error) {
    // Only log the full error in development/test
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }

    if (error.code === "P2002") {
      return res.status(400).render("register", {
        error: "Email already exists.",
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
      });
    }
    return res.status(500).render("register", {
      error: "An error occurred during registration.",
      isAuthenticated: req.isAuthenticated(),
      user: req.user,
    });
  }
});

// --- Login Route ---
router.get("/login", (req, res) => {
  res.render("login", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
  });
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error(err);
      return res.status(500).render("login", {
        error: "An error occurred during login.",
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
      });
    }

    if (!user) {
      return res.status(401).render("login", {
        error: info.message,
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).render("login", {
          error: "An error occurred during login.",
          isAuthenticated: req.isAuthenticated(),
          user: req.user,
        });
      }
      return res.redirect("/");
    });
  })(req, res, next);
});

// --- Logout Route ---
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

module.exports = router;
