// Where the welcome screen (/) sends people. Register and log in share the
// existing /login page; ?mode=register opens it on the Register tab.

export const REGISTER_HREF = "/login?mode=register";
export const LOGIN_HREF = "/login";

export type AuthMode = "login" | "register";

/** The tab /login opens on, from its ?mode= value. */
export function authModeFrom(param: string | null): AuthMode {
  return param === "register" ? "register" : "login";
}

/** Where / should go: the dashboard once a stored session has been read,
 * or nowhere (stay and show the welcome screen). */
export function welcomeRedirect(ready: boolean, token: string | null): string | null {
  return ready && token ? "/dashboard" : null;
}
