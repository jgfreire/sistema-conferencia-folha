"use strict";

const express = require("express");
const visionController = require("../controllers/visionController");

const router = express.Router();

router.post("/extract", visionController.extract);

module.exports = router;
