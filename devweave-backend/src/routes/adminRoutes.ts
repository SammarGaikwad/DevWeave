import { Router } from 'express';
import { Role } from '../generated/prisma/enums.js';
import { getUsers } from '../controllers/adminController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.get('/users', authenticate, authorize(Role.ADMIN), getUsers);

export default router;
