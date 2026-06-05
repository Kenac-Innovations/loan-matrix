export async function register() {
  // Queue consumers should only start in the Node.js server runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/queue-initializer");
  }
}
