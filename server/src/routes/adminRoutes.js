// Toda rota aqui passa por requireAuthApi + requireAdminApi antes de chegar no controller —
// aplicado uma vez, no mount point (ver server/src/app.js: app.use('/api/admin', requireAuthApi, requireAdminApi, adminRoutes)).
"use strict";

const express = require("express");
const userController = require("../controllers/userController");
const adminInfoController = require("../controllers/adminInfoController");

const router = express.Router();

router.get("/dashboard", adminInfoController.dashboard);
router.get("/settings", adminInfoController.settings);
router.get("/logs", adminInfoController.logs);

router.get("/users", userController.list);
router.post("/users", userController.create);
router.put("/users/:id", userController.update);
router.post("/users/:id/role", userController.setRole);
router.post("/users/:id/password", userController.resetPassword);
router.post("/users/:id/block", userController.block);
router.post("/users/:id/unblock", userController.unblock);
router.delete("/users/:id", userController.remove);

module.exports = router;
