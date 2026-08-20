/*
 * cv-analysis — Chessveda's chess analysis service
 * Copyright (C) 2026 Midas 24x7 Games Private Limited
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details. You should have received a copy of the licence along with
 * this program; see the LICENSE file.
 */

import { Router } from "express";

import authenticate from "@/middleware/auth";
import health from "./health";
import review from "./review";
import position from "./position";

const router = Router();

// Health is deliberately outside the auth gate so orchestrators can probe it.
router.use(health);

router.use(authenticate, review);
router.use(authenticate, position);

export default router;
