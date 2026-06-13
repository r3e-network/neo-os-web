/**
 * Single source of truth for the social login lanes shown on /login and in
 * the connect modal, derived from the OAuth provider registry so the two
 * surfaces can never diverge (each id maps 1:1 onto
 * /api/auth/login-social's connection map).
 */

import { oauthProviders, type OAuthProvider } from "@/lib/oauth/store";

export interface SocialLoginProvider {
  id: OAuthProvider;
  name: string;
  iconSrc: string;
  /** Filled-button styling used by the standalone /login page. */
  loginButtonClass: string;
  loginTextClass: string;
}

const loginButtonStyles: Record<OAuthProvider, { button: string; text: string }> = {
  google: {
    button: "bg-white border border-gray-300 hover:bg-gray-50 transition-colors",
    text: "text-gray-800",
  },
  twitter: {
    button: "bg-sky-500 hover:bg-sky-600 transition-colors",
    text: "text-white",
  },
  github: {
    button: "bg-white border border-gray-300 hover:bg-gray-50 transition-colors",
    text: "text-gray-800",
  },
};

export const socialLoginProviders: SocialLoginProvider[] = oauthProviders.map(
  (provider) => ({
    id: provider.id,
    name: provider.name,
    iconSrc: provider.iconSrc,
    loginButtonClass: loginButtonStyles[provider.id].button,
    loginTextClass: loginButtonStyles[provider.id].text,
  }),
);
