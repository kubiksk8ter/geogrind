import { MapLoader } from "@/components/MapLoader";
import { APP_NAME } from "@/config";
import { generatePageMetadata } from "./metadata";

export const generateMetadata = generatePageMetadata;

export default function HomePage() {
  return (
    <main>
      <h1 className="sr-only">{APP_NAME}</h1>
      <MapLoader />
    </main>
  );
}
