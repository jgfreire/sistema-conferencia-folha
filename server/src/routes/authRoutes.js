"use strict";

const express = require("express");
const authController = require("../controllers/authController");
const { requireAuthApi } = require("../auth/middleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuthApi, authController.me);

module.exports = router;
