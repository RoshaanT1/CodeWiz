import { Button } from "@/components/ui/button";

/**
 * Plain HTML form that posts to the sign-out route, so it works as a Server
 * Component and without client JavaScript.
 */
export function SignOutButton() {
  return (
    <form action="/sign-out" method="post">
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
