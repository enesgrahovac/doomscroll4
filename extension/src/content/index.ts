import { twitterAdapter } from "./platforms/twitter";
import { PlatformAdapter } from "../shared/types";
import { getProfile } from "../shared/storage";
import { init } from "./observer";

const adapters: PlatformAdapter[] = [twitterAdapter];

async function main(): Promise<void> {
  const url = window.location.href;
  const adapter = adapters.find((a) => a.isMatch(url));

  if (!adapter) {
    console.log("[DS4] No matching platform for this page");
    return;
  }

  console.log(`[DS4] Detected platform: ${adapter.name}`);

  const profile = await getProfile();
  const platformConfig =
    profile.platforms[adapter.name as keyof typeof profile.platforms];

  if (!platformConfig?.enabled) {
    console.log(`[DS4] ${adapter.name} is disabled in profile`);
    return;
  }

  if (!profile.onboardingComplete) {
    console.log("[DS4] Onboarding not complete — skipping feed filtering");
    return;
  }

  init(adapter);
  console.log("[DS4] Content script initialized");
}

main();
