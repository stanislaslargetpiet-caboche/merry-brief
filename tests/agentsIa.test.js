import { describe, expect, it } from "vitest";
import { classifyAgent, looksAutomated } from "@/lib/agentsIa";

describe("classifyAgent", () => {
  it("reconnaît les robots d'entraînement, de recherche et d'utilisateur", () => {
    expect(classifyAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toEqual({ famille: "GPTBot", operateur: "OpenAI", type: "entrainement" });
    expect(classifyAgent("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)").famille).toBe("ClaudeBot");
    expect(classifyAgent("Mozilla/5.0 (compatible; PerplexityBot/1.0)").type).toBe("recherche");
    expect(classifyAgent("Mozilla/5.0 ... ChatGPT-User/1.0").type).toBe("utilisateur");
    expect(classifyAgent("Claude-User/1.0").famille).toBe("Claude-User");
  });
  it("distingue OAI-SearchBot de GPTBot", () => {
    expect(classifyAgent("OAI-SearchBot/1.0").famille).toBe("OAI-SearchBot");
  });
  it("ne prend ni un navigateur ordinaire ni Googlebot pour un agent IA", () => {
    expect(classifyAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15")).toBe(null);
    expect(classifyAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(null);
    expect(classifyAgent("")).toBe(null);
    expect(classifyAgent(undefined)).toBe(null);
  });
});

describe("looksAutomated", () => {
  it("repère webdriver et Chrome sans écran", () => {
    expect(looksAutomated({ webdriver: true, userAgent: "Mozilla/5.0 Chrome/120" })).toBe(true);
    expect(looksAutomated({ webdriver: false, userAgent: "Mozilla/5.0 HeadlessChrome/120.0" })).toBe(true);
  });
  it("laisse passer un navigateur ordinaire", () => {
    expect(looksAutomated({ webdriver: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1" })).toBe(false);
    expect(looksAutomated(null)).toBe(false);
  });
});
