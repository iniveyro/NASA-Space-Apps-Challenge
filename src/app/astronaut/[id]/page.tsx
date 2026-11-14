import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AstronautProfile } from "@/features/astronaut-profile";
import { PROFILES, findProfile } from "@/features/crew-health-data";

export function generateStaticParams() {
  return PROFILES.map((profile) => ({ id: profile.id }));
}

export async function generateMetadata({ params }: PageProps<"/astronaut/[id]">): Promise<Metadata> {
  const { id } = await params;
  const person = findProfile(id);
  return { title: person ? person.name : "Profile not found" };
}

export default async function AstronautPage({ params }: PageProps<"/astronaut/[id]">) {
  const { id } = await params;
  const person = findProfile(id);
  if (!person) notFound();
  return <AstronautProfile person={person} />;
}
