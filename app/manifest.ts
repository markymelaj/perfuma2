import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Consigna Privada',
    short_name: 'Consigna',
    description: 'App interna para venta a consignación',
    start_url: '/',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#030712',
    lang: 'es',
  };
}
