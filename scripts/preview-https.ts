import { preview } from "vite";
import { testTlsCredentials } from "../src/tests/helpers/test-tls";

const server = await preview({
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    https: testTlsCredentials(),
  },
});

server.printUrls();
