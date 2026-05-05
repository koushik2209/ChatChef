import { Router } from 'express';
import { requestOtp, verifyOtpHandler, register } from '../controllers/authController';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtpHandler);
router.post('/register', register);

export default router;
