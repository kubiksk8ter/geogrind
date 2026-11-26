import { createAcknowledgementStorage } from "@/components/terms/store/termsAcknowledgementStorage";
import {
  createTermsAcknowledgementStore,
  type TermsAcknowledgementStore,
} from "@/components/terms/store/termsAcknowledgementStore";
import { TERMS_VERSION } from "@/components/terms/termsConstants";
import { FakeStorage } from "./fakeStorage";

/** An acknowledgement store on a fake storage (test helper). */
export function termsStore(
  storage: Storage = new FakeStorage(),
  currentVersion = TERMS_VERSION,
): TermsAcknowledgementStore {
  return createTermsAcknowledgementStore({
    storage: createAcknowledgementStorage(() => storage),
    currentVersion,
  });
}

/** A store whose current terms version is already acknowledged, so no notice is shown. */
export function acknowledgedTermsStore(): TermsAcknowledgementStore {
  const store = termsStore();
  store.getState().acknowledge();
  return store;
}
