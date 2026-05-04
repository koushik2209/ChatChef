import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/prisma';
import { generateOtp, verifyOtp } from '../services/authService';

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    res.status(400).json({ success: false, message: 'phone is required' });
    return;
  }

  const seller = await prisma.seller.findUnique({ where: { whatsapp_number: phone } });
  if (!seller) {
    // Don't reveal whether the number exists — same response either way
    res.json({ success: true, message: 'OTP sent if number is registered' });
    return;
  }

  const otp = generateOtp(phone);
  // In production: send via SMS/WhatsApp. For now, log to console.
  console.log(`[auth] OTP for ${phone}: ${otp}`);

  res.json({ success: true, message: 'OTP sent if number is registered' });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body as { phone?: string; otp?: string };

  if (!phone || !otp) {
    res.status(400).json({ success: false, message: 'phone and otp are required' });
    return;
  }

  if (!verifyOtp(phone, otp)) {
    res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    return;
  }

  const seller = await prisma.seller.findUnique({ where: { whatsapp_number: phone } });
  if (!seller || !seller.is_active) {
    res.status(401).json({ success: false, message: 'Seller not found or inactive' });
    return;
  }

  const token = jwt.sign(
    { sellerId: seller.id, phone: seller.whatsapp_number },
    process.env.JWT_SECRET ?? 'changeme',
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      seller: {
        id: seller.id,
        name: seller.name,
        whatsapp_number: seller.whatsapp_number,
        upi_id: seller.upi_id,
      },
    },
  });
}
