import { Router } from 'express';
import { requestOtp, verifyOtpHandler } from '../controllers/authController';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtpHandler);

export default router;
