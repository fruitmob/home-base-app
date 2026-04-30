import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { db } from "@/lib/db";

async function main() {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required for auth smoke testing.");
  }

  const loginResponse = await login(
    new Request("http://homebase.local/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "auth-smoke-test",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({ email, password }),
    }),
  );

  if (loginResponse.status !== 200) {
    throw new Error(`Login route returned ${loginResponse.status}: ${await loginResponse.text()}`);
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Seeded owner user was not found after login.");
  }

  const session = await db.session.findFirst({
    where: {
      userId: user.id,
      userAgent: "auth-smoke-test",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    throw new Error("Login did not create an active session row.");
  }

  const loginAudit = await db.auditLog.findFirst({
    where: {
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!loginAudit) {
    throw new Error("Login did not write an auth.login audit row.");
  }

  const meResponse = await me(
    new Request("http://homebase.local/api/auth/me", {
      headers: {
        cookie: `hb_session=${session.id}`,
      },
    }),
  );

  if (meResponse.status !== 200) {
    throw new Error(`/api/auth/me returned ${meResponse.status}: ${await meResponse.text()}`);
  }

  const logoutResponse = await logout(
    new Request("http://homebase.local/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `hb_session=${session.id}; hb_csrf=auth-smoke-token`,
        "x-csrf-token": "auth-smoke-token",
      },
    }),
  );

  if (logoutResponse.status !== 200) {
    throw new Error(`Logout route returned ${logoutResponse.status}: ${await logoutResponse.text()}`);
  }

  const expiredSession = await db.session.findUnique({ where: { id: session.id } });

  if (!expiredSession || expiredSession.expiresAt > new Date()) {
    throw new Error("Logout did not expire the session row.");
  }

  console.log("Auth route smoke test: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
