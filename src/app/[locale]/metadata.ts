import type { Metadata } from "next";
import { APP_NAME } from "@/config";

export function generateIntroMetadata(): Metadata {
  return { title: APP_NAME };
}
