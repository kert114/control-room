import { redirect } from "next/navigation";

export default function Home() {
  redirect("/prototype/kyc?variant=A");
}
