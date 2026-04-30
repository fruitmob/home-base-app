import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

async function main() {
  // 1. Create a mock user
  const email = `test-${Date.now()}@example.com`;
  const user = await db.user.create({
    data: {
      email,
      passwordHash: "mock",
      role: "TECH",
    }
  });

  // 2. Create Video
  const mockCloudflareId = `cf-test-${Date.now()}`;
  const video = await db.video.create({
    data: {
      cloudflareId: mockCloudflareId,
      status: "UPLOADING",
      title: "Test Walkaround",
      uploadedByUserId: user.id
    }
  });

  if (!video.id || video.status !== "UPLOADING") {
     throw new Error("Failed to create video correctly");
  }

  // 3. Create Share Link
  const shareLink = await db.videoShareLink.create({
    data: {
      videoId: video.id,
      token: `token-${Date.now()}`
    }
  });

  if (!shareLink.id || shareLink.viewCount !== 0) {
      throw new Error("Failed to create share link correctly");
  }

  // 4. Fetch User with uploadedVideos populated
  const fetchedUser = await db.user.findUnique({
    where: { id: user.id },
    include: { uploadedVideos: true }
  });

  if (!fetchedUser || fetchedUser.uploadedVideos.length === 0 || fetchedUser.uploadedVideos[0].id !== video.id) {
       throw new Error("Failed to fetch user relationships correctly");
  }

  // Cleanup
  await db.video.delete({ where: { id: video.id } }); // Cascades share links
  await db.user.delete({ where: { id: user.id } });

  console.log("Lens schema smoke test: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
