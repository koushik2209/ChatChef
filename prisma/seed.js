const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Replace with the WhatsApp number registered on your Gupshup sandbox (no + or spaces)
const TEST_SELLER_NUMBER = '917981053846';

async function main() {
  const seller = await prisma.seller.upsert({
    where: { whatsapp_number: TEST_SELLER_NUMBER },
    update: { slug: 'test1' },
    create: {
      name: 'Priya Home Kitchen',
      whatsapp_number: TEST_SELLER_NUMBER,
      upi_id: 'priya@upi',
      slug: 'test1',
      is_active: true,
    },
  });

  console.log(`Seller: ${seller.name} (slug: ${seller.slug})`);

  const menuItems = [
    {
      name: 'Butter Chicken',
      price: 180,
      original_price: 220,
      category: 'Main Course',
      image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',
    },
    {
      name: 'Dal Tadka',
      price: 120,
      original_price: null,
      category: 'Main Course',
      image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
    },
    {
      name: 'Jeera Rice',
      price: 80,
      original_price: null,
      category: 'Rice',
      image_url: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400',
    },
  ];

  let created = 0;
  for (const item of menuItems) {
    const exists = await prisma.menuItem.findFirst({
      where: { seller_id: seller.id, name: item.name },
    });
    if (!exists) {
      await prisma.menuItem.create({
        data: { ...item, seller_id: seller.id, is_available: true },
      });
      created++;
    }
  }

  console.log(
    `Menu items: ${created} created, ${menuItems.length - created} already existed.`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
