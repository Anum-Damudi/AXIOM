import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "axiom-nexus-crime": { access: "public_read" },
    },
  },
});