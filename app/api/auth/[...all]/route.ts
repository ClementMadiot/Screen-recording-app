import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import aj, { slidingWindow, validateEmail } from "@/lib/arcjet";
import ip from "@arcjet/ip";
import { ArcjetDecision } from "@arcjet/next";

// Email validation -> Block fake emails
const emailValidation = aj.withRule(
  validateEmail({
    mode: "LIVE",
    block: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
  })
);

// Rate Limit
const rateLimit = aj.withRule(
  slidingWindow({
    mode: "LIVE",
    interval: "2m",
    max: 2, // Max 2 requests
    characteristics: ["fingerprint"],
  })
);

const protectedAuth = async (req: NextRequest): Promise<ArcjetDecision> => {
  const session = await auth.api.getSession({ headers: req.headers });

  let userId: string;

  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    userId = ip(req) || "127.0.0.1";
  }

  if (req.nextUrl.pathname.startsWith("/api/auth/sign-in")) {
    const body = await req.clone().json();

    if (typeof body.email === "string") {
      return emailValidation.protect(req, { email: body.email });
    }
  }

  return rateLimit.protect(req, { fingerprint: userId });
};

const authHandler = toNextJsHandler(auth.handler);
export const { GET } = authHandler;

export const POST = async (req: NextRequest) => {
  const decison = await protectedAuth(req);

  if (decison.isDenied()) {
    // Email failed
    if (decison.reason.isEmail()) {
      throw new Error("Email validation failed");
    }
    // Rate limit exceeded
    if (decison.reason.isRateLimit()) {
      throw new Error("Rate limit exceeded");
    }
    // Bad request
    if (decison.reason.isShield()) {
      throw new Error("Shield turned on, protect against malicious requests");
    }
  }

  return authHandler.POST(req);
};
