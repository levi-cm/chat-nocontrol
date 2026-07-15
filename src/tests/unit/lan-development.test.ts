import { describe, expect, it } from "vitest";
import manifest from "../../../package.json";
import runnerSource from "../../../scripts/dev-tailscale.ts?raw";

describe("local-network development access", () => {
  it("uses the secure Tailscale runner by default", () => {
    expect(manifest.scripts.dev).toBe("tsx scripts/dev-tailscale.ts");
    expect(manifest.scripts["dev:tailscale"]).toBe("npm run dev");
  });

  it("retains an explicitly named Tailscale-IP HTTP command", () => {
    expect(manifest.scripts["dev:http:tailscale"]).toBe(
      "vite --host $(tailscale ip -4) --port 5173 --strictPort",
    );
  });

  it("retains the explicit raw-LAN command", () => {
    expect(manifest.scripts["dev:lan" as keyof typeof manifest.scripts]).toBe(
      "vite --host 0.0.0.0",
    );
  });

  it("derives DNS from live status and runs foreground HTTPS Serve", () => {
    expect(runnerSource).toContain('"status", "--json"');
    expect(runnerSource).toContain('"--https=443"');
    expect(runnerSource).toContain('"http://127.0.0.1:5173"');
    expect(runnerSource).toContain('"127.0.0.1"');
    expect(runnerSource).toContain('"--strictPort"');
    expect(runnerSource).toContain("SIGTERM");
    expect(runnerSource).toContain("SIGINT");
  });

  it("allows only the live Tailscale DNS hostname through Vite", () => {
    expect(runnerSource).toContain(
      "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: hostname",
    );
    expect(runnerSource).not.toContain("allowedHosts: true");
  });
});
