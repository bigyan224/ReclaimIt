import express from "express";
import { getInstitutionById, getMyInstitutions } from "../controllers/institutions.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/me", getMyInstitutions);
router.get("/:id", getInstitutionById);

export default router;
