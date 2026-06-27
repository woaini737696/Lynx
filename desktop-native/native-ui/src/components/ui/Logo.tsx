interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
}

export function Logo({ className = "w-8 h-8", variant = "dark" }: LogoProps) {
  const bg = variant === "dark" ? "#030816" : "#ffffff";
  const fg = variant === "dark" ? "#ffffff" : "#030816";

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="512" height="512" rx="128" fill={bg} />
      <path
        d="M368 144c-32 8-72 32-96 56-8-16-24-40-48-48-40-12-88 16-104 48-16 32-8 80 16 112 24 32 64 48 104 40 16-4 32-12 44-24 12 12 28 20 44 24 40 8 80-8 104-40 24-32 32-80 16-112-16-32-64-60-104-48-8 2-16 6-24 10 12-12 32-24 48-28l-16-28c-16 4-40 20-56 36 0-4-4-8-4-12 8-16 16-28 28-40l-20-24c-16 16-28 36-36 56z"
        fill={fg}
      />
      <path
        d="M168 208c16-8 36-4 48 8 8 8 12 20 12 32-16 4-32 0-44-12-12-12-16-28-16-28z"
        fill={bg}
      />
      <path
        d="M220 280c-8 16-24 28-44 32-20 4-40-4-52-20-8-12-8-28 0-40 8-16 28-24 48-24 20 0 40 12 52 28 8 12 8 24-4 24z"
        fill={fg}
      />
      <circle cx="196" cy="232" r="14" fill={fg} />
      <circle cx="198" cy="228" r="5" fill={bg} />
    </svg>
  );
}
