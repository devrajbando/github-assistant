import { prisma } from "./client";

async function main() {
  const userCount = await prisma.user.count();
  console.log(`Connected. User count: ${userCount}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});