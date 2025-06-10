import arcjet, { detectBot, shield, fixedWindow, request, slidingWindow, validateEmail } from "@arcjet/next";

// Re-export the rules to simplify imports inside handlers
export { detectBot, shield, fixedWindow, request, slidingWindow, validateEmail };

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [],
});

export default aj;
