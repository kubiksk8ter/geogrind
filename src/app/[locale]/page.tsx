import { IntroScreen } from "@/components/IntroScreen";
import { generateIntroMetadata } from "./metadata";

export const generateMetadata = generateIntroMetadata;

export default function HomePage() {
  return <IntroScreen />;
}
