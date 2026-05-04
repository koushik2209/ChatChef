import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const seller = await prisma.seller.upsert({
    where: { whatsapp_number: '919999999999' },
    update: {},
    create: {
      name: 'Priya Home Kitchen',
      whatsapp_number: '919999999999',
      upi_id: 'priya@upi',
      is_active: true,
    },
  });

  console.log(`Seller: ${seller.name} (id: ${seller.id})`);

  const menuItems = [
    { name: 'Butter Chicken',  price: 180, original_price: 220, category: 'Main Course', image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400' },
    { name: 'Dal Tadka',        price: 120, original_price: null, category: 'Main Course', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400' },
    { name: 'Jeera Rice',       price:  80, original_price: null, category: 'Rice',        image_url: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400' },
    { name: 'Samosa (2 pcs)',   price:  40, original_price:  50, category: 'Snacks',      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400' },
    { name: 'Mango Lassi',      price:  60, original_price: null, category: 'Drinks',     image_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400' },
  ];

  // Clear existing menu items for this seller and recreate (idempotent seed)
  await prisma.menuItem.deleteMany({ where: { seller_id: seller.id } });
  await prisma.menuItem.createMany({
    data: menuItems.map((item) => ({ ...item, seller_id: seller.id, is_available: true })),
  });

  console.log(`Seeded ${menuItems.length} menu items.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
