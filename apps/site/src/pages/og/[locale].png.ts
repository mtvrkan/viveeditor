import type { APIRoute, GetStaticPaths } from 'astro'
import { homePath, LOCALES, SITE_URL } from '../../i18n'
import { HOME } from '../../i18n/home'
import { type Card, cardPng } from '../../og/card'

export const getStaticPaths = (() =>
  LOCALES.map((locale) => {
    const copy = HOME[locale]
    const card: Card = {
      lang: locale,
      eyebrow: copy.hero.eyebrow,
      title: `${copy.hero.heading} ${copy.hero.headingEm}`,
      description: copy.description,
      address: `${new URL(SITE_URL).host}${homePath(locale)}`.replace(/\/$/, ''),
    }
    return { params: { locale }, props: { card } }
  })) satisfies GetStaticPaths

export const GET: APIRoute = ({ props }) =>
  new Response(cardPng((props as { card: Card }).card), {
    headers: { 'Content-Type': 'image/png' },
  })
