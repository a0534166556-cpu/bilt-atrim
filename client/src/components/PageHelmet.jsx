import { Helmet } from 'react-helmet-async';
import { useStore } from '../context/StoreContext';

export default function PageHelmet({ title, description, ogImage }) {
  const { store } = useStore();
  const name = store?.name || 'NovaShop';
  const fullTitle = title ? `${title} | ${name}` : name;
  const desc = description || store?.tagline || '';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:type" content="website" />
      {ogImage && <meta property="og:image" content={ogImage} />}
    </Helmet>
  );
}
