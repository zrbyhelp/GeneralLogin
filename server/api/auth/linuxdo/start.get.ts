import { getQuery, setCookie, sendRedirect } from "h3";
import {
  buildExternalLoginState,
  getLinuxdoAuthorizeUrl
} from "~/server/utils/auth-service";
import { generateToken } from "~/server/utils/crypto";

const OAUTH_COOKIE = "zr_linuxdo_state";
const OAUTH_MAX_AGE = 10 * 60;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const clientId = typeof query.client_id === "string" ? query.client_id : "";
  const callbackUrl = typeof query.callback === "string" ? query.callback : "";
  const state = typeof query.state === "string" ? query.state : "";
  const theme = typeof query.theme === "string" ? query.theme : "";
  const locale = typeof query.locale === "string" ? query.locale : "";
  const loginHint = typeof query.login_hint === "string" ? query.login_hint : "";

  const portalState = generateToken(24);
  setCookie(
    event,
    OAUTH_COOKIE,
    buildExternalLoginState({
      oauthState: portalState,
      clientId,
      callbackUrl,
      state,
      theme,
      locale
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OAUTH_MAX_AGE
    }
  );

  return sendRedirect(event, getLinuxdoAuthorizeUrl(portalState, loginHint), 302);
});
