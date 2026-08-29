import { redirect } from "next/navigation";

/** La sezione amici ora si chiama Pickmates: i vecchi collegamenti restano validi. */
export default function PickpocketsRedirect() {
  redirect("/pickmates");
}
