import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Single-plan model: one plan, three prepaid terms (1/6/12 months).
  // The 1-month term never gets the early-bird rate — see
  // lib/pricing.ts effectiveRatePaise().
  const activePlan = {
    code: "growth",
    name: "Dorway",
    normalPaiseMonth: 199900n, // ₹1,999/mo
    earlyPaiseMonth: 99900n, // ₹999/mo — 6 & 12 month terms only, while early-bird is open
    seatCap: null,
    numberCap: 1,
    sortOrder: 1,
    isActive: true,
    features: [
      "Shared team inbox",
      "Automatic lead assignment",
      "Follow-up sequences",
      "Bulk campaigns and segments",
      "Unlimited templates with approval tracking",
      "Account health and quality monitoring",
      "Priority support",
    ],
  };

  // Old tiers retired in favour of the single plan above — kept isActive:
  // false rather than deleted so historical orders/entitlements referencing
  // them stay valid.
  const retiredPlans = [
    { code: "starter", name: "Starter", normalPaiseMonth: 99900n, earlyPaiseMonth: 49900n, seatCap: 2, numberCap: 1, sortOrder: 2, isActive: false, features: [] as string[] },
    { code: "scale", name: "Scale", normalPaiseMonth: 399900n, earlyPaiseMonth: 199900n, seatCap: null, numberCap: 3, sortOrder: 3, isActive: false, features: [] as string[] },
  ];

  for (const plan of [activePlan, ...retiredPlans]) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  const launchAt = new Date("2026-09-23T05:30:00.000Z"); // 11:00 IST
  await prisma.launchConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      launchAt,
      earlyBirdEndsAt: launchAt,
      earlyBirdSeatCap: 100,
      earlyBirdForceClose: false,
      checkoutEnabled: true,
      gstPercent: 18.0,
    },
  });

  console.log("Seeded single-plan pricing + launch_config.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
