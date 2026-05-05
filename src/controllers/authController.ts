import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/prisma';
import { generateOtp, verifyOtp } from '../services/authService';

// ── OTP login ────────────────────────────────────────────────────────────────

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    res.status(400).json({ success: false, message: 'phone is required' });
    return;
  }

  const seller = await prisma.seller.findUnique({ where: { whatsapp_number: phone } });
  if (!seller) {
    res.json({ success: true, message: 'OTP sent if number is registered' });
    return;
  }

  const otp = generateOtp(phone);
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
        slug: seller.slug,
      },
    },
  });
}

// ── Registration ─────────────────────────────────────────────────────────────

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug();
    const existing = await prisma.seller.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  throw new Error('Could not generate unique slug after 10 attempts');
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, whatsapp_number, upi_id } = req.body as {
    name?: string;
    whatsapp_number?: string;
    upi_id?: string;
  };

  if (!name || !whatsapp_number || !upi_id) {
    res.status(400).json({ success: false, message: 'name, whatsapp_number, and upi_id are required' });
    return;
  }

  const existing = await prisma.seller.findUnique({ where: { whatsapp_number } });
  if (existing) {
    res.status(409).json({ success: false, message: 'This WhatsApp number is already registered' });
    return;
  }

  const slug = await generateUniqueSlug();

  const seller = await prisma.seller.create({
    data: { name, whatsapp_number, upi_id, slug, is_active: true },
  });

  res.status(201).json({
    success: true,
    data: {
      id: seller.id,
      name: seller.name,
      whatsapp_number: seller.whatsapp_number,
      upi_id: seller.upi_id,
      slug: seller.slug,
    },
  });
}
