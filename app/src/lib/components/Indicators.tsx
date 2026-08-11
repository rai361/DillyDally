function PriceIndicator({ price, size = 'sm' }: { price: number; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span className={`${textSize} readable-font font-bold tracking-tight text-[#3f7a4e]`}>
      {'$'.repeat(price)}
      <span className="text-[#3f7a4e]/25">{'$'.repeat(4 - price)}</span>
    </span>
  );
}

function HypeIndicator({ hype, size = 'sm' }: { hype: number; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-xl' : 'text-base';
  return (
    <span className={textSize}>
      {'🔥'.repeat(hype)}
      <span className="opacity-20">{'🔥'.repeat(5 - hype)}</span>
    </span>
  );
}

function TimeIndicator({ time, size = 'sm' }: { time: string; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-lg' : 'text-sm';
  return (
    <span className={`${textSize} readable-font font-semibold text-[#3d6ea1]`}>⏱️ {time}</span>
  );
}

export { PriceIndicator, HypeIndicator, TimeIndicator };