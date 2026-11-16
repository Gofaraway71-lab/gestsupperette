import React, { useState } from 'react';

const CATEGORY_VISUALS = [
  { match: 'boisson', bg: '#e0f2fe', fg: '#0284c7', icon: '🥤' },
  { match: 'crèm', bg: '#fef9c3', fg: '#ca8a04', icon: '🥛' },
  { match: 'crem', bg: '#fef9c3', fg: '#ca8a04', icon: '🥛' },
  { match: 'boulang', bg: '#ffedd5', fg: '#ea580c', icon: '🥖' },
  { match: 'café', bg: '#f3e8ff', fg: '#7e22ce', icon: '☕' },
  { match: 'cafe', bg: '#f3e8ff', fg: '#7e22ce', icon: '☕' },
  { match: 'biscuit', bg: '#fce7f3', fg: '#db2777', icon: '🍪' },
  { match: 'conserve', bg: '#fee2e2', fg: '#dc2626', icon: '🥫' },
  { match: 'hygi', bg: '#dcfce7', fg: '#16a34a', icon: '🧼' },
  { match: 'épic', bg: '#f1f5f9', fg: '#0f766e', icon: '🛒' },
  { match: 'epic', bg: '#f1f5f9', fg: '#0f766e', icon: '🛒' }
];

function getVisual(product) {
  const cat = String(product?.category || '').toLowerCase();
  const name = String(product?.name || '').toLowerCase();
  if (name.includes('eau')) return { bg: '#e0f2fe', fg: '#0284c7', icon: '💧' };
  if (name.includes('œuf') || name.includes('oeuf')) return { bg: '#fef3c7', fg: '#d97706', icon: '🥚' };
  if (name.includes('huile')) return { bg: '#fef9c3', fg: '#ca8a04', icon: '🫗' };
  if (name.includes('sucre')) return { bg: '#f1f5f9', fg: '#475569', icon: '🧂' };
  const found = CATEGORY_VISUALS.find((v) => cat.includes(v.match));
  return found || { bg: '#e2e8f0', fg: '#0f766e', icon: '📦' };
}

export default function ProductThumb({ product, size = 44 }) {
  const [imgError, setImgError] = useState(false);

  if (product?.image && !imgError) {
    return (
      <img
        src={product.image}
        alt={product.name || ''}
        className="fav-thumb-img"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  const vis = getVisual(product);
  return (
    <div
      className="fav-thumb-fallback"
      style={{
        width: size,
        height: size,
        backgroundColor: vis.bg,
        color: vis.fg,
        fontSize: Math.round(size * 0.5)
      }}
      aria-hidden="true"
    >
      {vis.icon}
    </div>
  );
}
